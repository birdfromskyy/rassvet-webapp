package handlers

// Test harness for the API handlers.
//
// Isolation model ("откат к прежнему состоянию"):
//   • one throwaway Postgres database `reviews_test` (migrated once in TestMain);
//   • EACH test runs inside a transaction that is ROLLED BACK on cleanup, so it
//     leaves zero residue and never touches dev/prod data;
//   • Redis is an in-process miniredis (nothing real is touched).
//
// Requires a reachable Postgres (dev compose: `docker compose ... up -d postgres`).
// If none is reachable, the whole package is skipped — `go test` won't hard-fail.

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"
	"bytes"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const testJWTSecret = "test-jwt-secret-0123456789-abcdefghijklmnop"

var baseDB *gorm.DB // connected to reviews_test and migrated once

func getEnv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	_ = godotenv.Load("../../.env") // pull DB_USER / DB_PASSWORD if present
	host := getEnv("TEST_DB_HOST", "localhost")
	port := getEnv("TEST_DB_PORT", "5433")
	user := getEnv("DB_USER", "postgres")
	pass := os.Getenv("DB_PASSWORD")
	name := getEnv("TEST_DB_NAME", "reviews_test")

	if pass == "" {
		log.Println("SKIP handler tests: DB_PASSWORD not set (no test Postgres)")
		os.Exit(0)
	}

	// 1) ensure the throwaway test database exists (connect to the default db).
	adminDSN := fmt.Sprintf("host=%s user=%s password=%s dbname=postgres port=%s sslmode=disable", host, user, pass, port)
	admin, err := gorm.Open(postgres.Open(adminDSN), &gorm.Config{})
	if err != nil {
		log.Printf("SKIP handler tests: cannot reach Postgres: %v", err)
		os.Exit(0)
	}
	admin.Exec("CREATE DATABASE " + name) // ignore "already exists"

	// 2) connect to the test db and migrate the schema once.
	testDSN := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable", host, user, pass, name, port)
	baseDB, err = gorm.Open(postgres.Open(testDSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("cannot open %s: %v", name, err)
	}
	database.Migrate(baseDB)

	os.Exit(m.Run())
}

// testEnv is one isolated test world.
type testEnv struct {
	db     *gorm.DB // a transaction, rolled back on cleanup
	rdb    *redis.Client
	cfg    *config.Config
	router *gin.Engine
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	if baseDB == nil {
		t.Skip("no test database available")
	}

	tx := baseDB.Begin()
	require.NoError(t, tx.Error)
	t.Cleanup(func() { tx.Rollback() })

	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := &config.Config{
		JWTSecret:    testJWTSecret,
		IsProduction: false,
		FrontendURL:  "http://localhost:3000",
	}

	return &testEnv{db: tx, rdb: rdb, cfg: cfg, router: buildTestRouter(tx, rdb, cfg)}
}

// buildTestRouter wires the subset of routes exercised by the tests, using the
// real middleware so access control is covered end-to-end.
func buildTestRouter(db *gorm.DB, rdb *redis.Client, cfg *config.Config) *gin.Engine {
	r := gin.New()

	auth := NewAuthHandler(db, rdb, cfg)
	review := NewReviewHandler(db)
	admin := NewAdminHandler(db)
	report := NewReportHandler(db)
	us := NewUserStudentHandler(db)

	r.POST("/api/login", auth.Login)
	r.POST("/api/refresh", auth.Refresh)

	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret, rdb))
	protected.Use(middleware.AuditLog())
	{
		protected.GET("/me", auth.GetMe)
		protected.PUT("/profile", auth.UpdateProfile)
		protected.POST("/logout", auth.Logout)
		protected.POST("/reviews", review.CreateReview)
		protected.GET("/my-reviews", review.GetMyReviews)
		protected.GET("/reviews", review.GetPublishedReviews)

		adm := protected.Group("/admin")
		adm.Use(middleware.AdminMiddleware())
		{
			adm.GET("/users", us.GetUsers)
			adm.GET("/reports/monthly", report.GetMonthlyReport)
			adm.GET("/reviews", admin.GetAllReviews)
			adm.PUT("/reviews/:id/approve", admin.ApproveReview)
			adm.PUT("/reviews/:id/reject", admin.RejectReview)
		}
	}
	return r
}

// --- helpers ---------------------------------------------------------------

func (e *testEnv) seedUser(t *testing.T, email, password, role string, verified bool) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	require.NoError(t, err)
	u := &models.User{
		Email:      email,
		Password:   string(hash),
		FirstName:  "Test",
		LastName:   "User",
		Role:       models.UserRole(role),
		IsVerified: verified,
	}
	require.NoError(t, e.db.Create(u).Error)
	return u
}

// do sends a request; body may be "" for none; cookies may be nil.
func (e *testEnv) do(method, path, body string, cookies []*http.Cookie) *httptest.ResponseRecorder {
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
	}
	for _, c := range cookies {
		r.AddCookie(c)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, r)
	return w
}

// login performs a real login and returns the session cookies.
func (e *testEnv) login(t *testing.T, email, password string) []*http.Cookie {
	t.Helper()
	w := e.do("POST", "/api/login", fmt.Sprintf(`{"email":%q,"password":%q}`, email, password), nil)
	require.Equal(t, http.StatusOK, w.Code, "login must succeed: %s", w.Body.String())
	return w.Result().Cookies()
}
