package main

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func serveHTML(siteDir string, fileName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		fullPath := filepath.Join(siteDir, fileName)

		if _, err := os.Stat(fullPath); err != nil {
			c.String(http.StatusNotFound, "Page not found")
			return
		}

		c.File(fullPath)
	}
}

func main() {
	// Load config
	cfg := config.Load()

	// Initialize PostgreSQL
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Initialize Redis
	rdb, err := database.InitializeRedis(cfg)
	if err != nil {
		log.Fatal("Failed to connect to redis:", err)
	}

	// Auto migrate only our models
	database.Migrate(db)

	// Setup Gin
	r := gin.Default()

	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, rdb, cfg)
	reviewHandler := handlers.NewReviewHandler(db)
	adminHandler := handlers.NewAdminHandler(db)

	// Public API routes
	r.POST("/api/register", authHandler.Register)
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/verify-email", authHandler.VerifyEmail)
	r.POST("/api/resend-code", authHandler.ResendCode)
	r.POST("/api/forgot-password", authHandler.ForgotPassword)
	r.POST("/api/reset-password", authHandler.ResetPassword)

	// Protected API routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.PUT("/profile", authHandler.UpdateProfile)
		protected.POST("/logout", authHandler.Logout)
		protected.GET("/me", authHandler.GetMe)

		// Review routes
		protected.GET("/reviews", reviewHandler.GetPublishedReviews)
		protected.POST("/reviews", reviewHandler.CreateReview)
		protected.GET("/my-reviews", reviewHandler.GetMyReviews)
		protected.GET("/reviews/check", reviewHandler.CheckUserReview)
		protected.PUT("/reviews/my", reviewHandler.UpdateMyReview)

		// Admin routes
		admin := protected.Group("/admin")
		admin.Use(middleware.AdminMiddleware())
		{
			admin.GET("/reviews", adminHandler.GetAllReviews)
			admin.GET("/reviews/pending", adminHandler.GetPendingReviews)
			admin.PUT("/reviews/:id", adminHandler.UpdateReview)
			admin.DELETE("/reviews/:id", adminHandler.DeleteReview)
			admin.PUT("/reviews/:id/approve", adminHandler.ApproveReview)
			admin.PUT("/reviews/:id/reject", adminHandler.RejectReview)
		}
	}

	siteDir := "./static/site"

	r.NoRoute(func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "404.html"))
	})

	// Static assets from exported Tilda site
	r.Static("/css", filepath.Join(siteDir, "css"))
	r.Static("/js", filepath.Join(siteDir, "js"))
	r.Static("/images", filepath.Join(siteDir, "images"))
	r.Static("/files", filepath.Join(siteDir, "files"))

	// Static files
	r.GET("/robots.txt", func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "robots.txt"))
	})
	r.GET("/sitemap.xml", func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "sitemap.xml"))
	})
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	r.GET("/reviews", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "http://localhost:3000/reviews")
	})

	// Public Tilda pages
	r.GET("/", serveHTML(siteDir, "main.html"))
	r.GET("/main", serveHTML(siteDir, "main.html"))

	r.GET("/about_services", serveHTML(siteDir, "about_services.html"))
	r.GET("/available_services", serveHTML(siteDir, "available_services.html"))
	r.GET("/contacts", serveHTML(siteDir, "contacts.html"))
	r.GET("/docs", serveHTML(siteDir, "docs.html"))
	r.GET("/employees", serveHTML(siteDir, "employees.html"))
	r.GET("/fin_activities", serveHTML(siteDir, "fin_activities.html"))
	r.GET("/history", serveHTML(siteDir, "history.html"))
	r.GET("/how_to", serveHTML(siteDir, "how_to.html"))
	r.GET("/internal_rules", serveHTML(siteDir, "internal_rules.html"))
	r.GET("/mission", serveHTML(siteDir, "mission.html"))
	r.GET("/quantity_of_services", serveHTML(siteDir, "quantity_of_services.html"))
	r.GET("/rating", serveHTML(siteDir, "rating.html"))
	r.GET("/social_service", serveHTML(siteDir, "social_service.html"))
	r.GET("/structure", serveHTML(siteDir, "structure.html"))
	r.GET("/vacancies", serveHTML(siteDir, "vacancies.html"))
	r.GET("/want_to_help", serveHTML(siteDir, "want_to_help.html"))

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
