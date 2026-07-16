package handlers

import (
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/services"
	"backend/internal/utils"
	"context"
	crand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	rdb *redis.Client
	cfg *config.Config
}

type PendingRegistration struct {
	Email          string `json:"email"`
	PasswordHash   string `json:"password_hash"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	MiddleName     string `json:"middle_name"`
	Code           string `json:"code"`
	Attempts       int    `json:"attempts"`
	ConsentGiven   bool   `json:"consent_given"`
	ConsentVersion string `json:"consent_version"`
}

type PendingEmailVerification struct {
	UserID   uint   `json:"user_id"`
	Email    string `json:"email"`
	Code     string `json:"code"`
	Attempts int    `json:"attempts"`
}

type PendingPasswordReset struct {
	Code     string `json:"code"`
	Attempts int    `json:"attempts"`
}

const verificationCodeCooldown = 60 * time.Second
const maxVerificationAttempts = 5
const currentConsentVersion = "v1"

const accessTokenMaxAge = 30 * 60 // 30 min in seconds (matches JWT TTL)
const refreshTokenTTL = 7 * 24 * time.Hour
const refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days in seconds

func refreshKey(token string) string { return "refresh:" + token }

// userSessionsKey holds the set of a user's active refresh tokens, so every
// device can be logged out at once (e.g. when the password changes).
func userSessionsKey(userID uint) string { return fmt.Sprintf("user_sessions:%d", userID) }

// userAccessTokensKey lets an administrator terminate already-issued access
// JWTs too. JWTs are otherwise self-contained until their 30-minute expiry.
func userAccessTokensKey(userID uint) string { return fmt.Sprintf("user_access_tokens:%d", userID) }

// issueTokenPair generates a new access JWT + refresh UUID, sets both cookies,
// and stores the refresh token in Redis.
func (h *AuthHandler) issueTokenPair(c *gin.Context, userID uint, role string) error {
	accessToken, err := utils.GenerateToken(userID, role, h.cfg.JWTSecret)
	if err != nil {
		return err
	}

	refreshToken := uuid.NewString()
	payload, _ := json.Marshal(map[string]interface{}{
		"user_id": userID,
		"role":    role,
	})
	if err := h.rdb.Set(c.Request.Context(), refreshKey(refreshToken), payload, refreshTokenTTL).Err(); err != nil {
		return err
	}

	// Track the token in the user's session set so all devices can be revoked
	// together on a password change.
	sessCtx := c.Request.Context()
	_ = h.rdb.SAdd(sessCtx, userSessionsKey(userID), refreshToken).Err()
	_ = h.rdb.Expire(sessCtx, userSessionsKey(userID), refreshTokenTTL).Err()
	_ = h.rdb.SAdd(sessCtx, userAccessTokensKey(userID), accessToken).Err()
	_ = h.rdb.Expire(sessCtx, userAccessTokensKey(userID), time.Duration(accessTokenMaxAge)*time.Second).Err()

	secure := h.cfg.IsProduction
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   accessTokenMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   refreshTokenMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	// Clear legacy cookie that was previously set with Path=/api/refresh
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/refresh",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// clearAuthCookies removes both auth cookies and deletes the refresh token from Redis.
func (h *AuthHandler) clearAuthCookies(c *gin.Context) {
	secure := h.cfg.IsProduction
	http.SetCookie(c.Writer, &http.Cookie{
		Name: "token", Value: "", Path: "/",
		MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name: "refresh_token", Value: "", Path: "/",
		MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	})
	// Clear legacy cookie that was previously set with Path=/api/refresh
	http.SetCookie(c.Writer, &http.Cookie{
		Name: "refresh_token", Value: "", Path: "/api/refresh",
		MaxAge: -1, HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	})
	if rt, err := c.Cookie("refresh_token"); err == nil && rt != "" {
		_ = h.rdb.Del(c.Request.Context(), refreshKey(rt)).Err()
	}
}

// invalidateUserSessions revokes every refresh token of a user — logs them out
// on all devices. Returns how many sessions were revoked. Called on password change.
func (h *AuthHandler) invalidateUserSessions(ctx context.Context, userID uint) int {
	setKey := userSessionsKey(userID)
	n := 0
	if tokens, err := h.rdb.SMembers(ctx, setKey).Result(); err == nil {
		n = len(tokens)
		for _, t := range tokens {
			_ = h.rdb.Del(ctx, refreshKey(t)).Err()
		}
	}
	_ = h.rdb.Del(ctx, setKey).Err()
	accessKey := userAccessTokensKey(userID)
	if tokens, err := h.rdb.SMembers(ctx, accessKey).Result(); err == nil {
		for _, token := range tokens {
			_ = h.rdb.Set(ctx, "blacklist:"+token, "1", time.Duration(accessTokenMaxAge)*time.Second).Err()
		}
	}
	_ = h.rdb.Del(ctx, accessKey).Err()
	return n
}

var (
	pwUpperRe = regexp.MustCompile(`[A-Z]`)
	pwDigitRe = regexp.MustCompile(`[0-9]`)
)

func NewAuthHandler(db *gorm.DB, rdb *redis.Client, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, rdb: rdb, cfg: cfg}
}

// generateCode returns a cryptographically random 6-digit code.
func generateCode() string {
	max := big.NewInt(1_000_000)
	n, err := crand.Int(crand.Reader, max)
	if err != nil {
		// fallback should never happen on a healthy system
		panic("crypto/rand unavailable: " + err.Error())
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// validatePassword enforces: min 8 chars, ≥1 uppercase, ≥1 digit.
func validatePassword(p string) error {
	if len(p) < 8 {
		return errors.New("Пароль должен содержать не менее 8 символов")
	}
	if !pwUpperRe.MatchString(p) {
		return errors.New("Пароль должен содержать хотя бы одну заглавную букву")
	}
	if !pwDigitRe.MatchString(p) {
		return errors.New("Пароль должен содержать хотя бы одну цифру")
	}
	return nil
}

type RegisterRequest struct {
	Email        string `json:"email"          binding:"required,email,max=254"`
	Password     string `json:"password"       binding:"required,min=8,max=128"`
	FirstName    string `json:"first_name"     binding:"required,max=100"`
	LastName     string `json:"last_name"      binding:"required,max=100"`
	MiddleName   string `json:"middle_name"    binding:"max=100"`
	ConsentGiven bool   `json:"consent_given"`
}

type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code"  binding:"required"`
}

func verificationCooldownKey(email string) string {
	return "cooldown:verify:" + strings.ToLower(strings.TrimSpace(email))
}

func registerKey(email string) string {
	return "register:" + strings.ToLower(strings.TrimSpace(email))
}

func emailVerificationKey(email string) string {
	return "verify_email:" + strings.ToLower(strings.TrimSpace(email))
}

func (h *AuthHandler) getVerificationCooldown(ctx context.Context, email string) (time.Duration, error) {
	ttl, err := h.rdb.TTL(ctx, verificationCooldownKey(email)).Result()
	if err != nil {
		return 0, err
	}
	if ttl > 0 {
		return ttl, nil
	}
	return 0, nil
}

func (h *AuthHandler) setVerificationCooldown(ctx context.Context, email string) error {
	return h.rdb.Set(ctx, verificationCooldownKey(email), "1", verificationCodeCooldown).Err()
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	if !req.ConsentGiven {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо согласие на обработку персональных данных"})
		return
	}

	if err := validatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже зарегистрирован"})
		return
	}

	ctx := context.Background()

	cooldown, err := h.getVerificationCooldown(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	if cooldown > 0 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               fmt.Sprintf("Код уже отправлен. Повторите через %d сек.", int(cooldown.Seconds())+1),
			"retry_after_seconds": int(cooldown.Seconds()) + 1,
		})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	code := generateCode()
	pending := PendingRegistration{
		Email:          req.Email,
		PasswordHash:   string(hashedPassword),
		FirstName:      strings.TrimSpace(req.FirstName),
		LastName:       strings.TrimSpace(req.LastName),
		MiddleName:     strings.TrimSpace(req.MiddleName),
		Code:           code,
		ConsentGiven:   true,
		ConsentVersion: currentConsentVersion,
	}

	data, err := json.Marshal(pending)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	key := registerKey(req.Email)
	if err := h.rdb.Set(ctx, key, data, 15*time.Minute).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	emailService := services.NewEmailService(h.cfg)
	if err := emailService.SendVerificationCode(req.Email, code); err != nil {
		_ = h.rdb.Del(ctx, key).Err()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить письмо. Попробуйте позже"})
		return
	}

	if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Код подтверждения отправлен. Проверьте почту.",
		"email":   req.Email,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		log.Printf("[LOGIN] email=%s ip=%s success=false reason=user_not_found ua=%q", req.Email, c.ClientIP(), c.Request.UserAgent())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		log.Printf("[LOGIN] email=%s ip=%s success=false reason=wrong_password ua=%q", user.Email, c.ClientIP(), c.Request.UserAgent())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный email или пароль"})
		return
	}

	if !user.IsVerified {
		log.Printf("[LOGIN] email=%s ip=%s success=false reason=not_verified ua=%q", user.Email, c.ClientIP(), c.Request.UserAgent())
		ctx := context.Background()

		cooldown, err := h.getVerificationCooldown(ctx, user.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		if cooldown > 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"error":               "Email не подтверждён",
				"message":             fmt.Sprintf("Код уже отправлен. Повторите через %d сек.", int(cooldown.Seconds())+1),
				"retry_after_seconds": int(cooldown.Seconds()) + 1,
				"email":               user.Email,
			})
			return
		}

		code := generateCode()
		pending := PendingEmailVerification{UserID: user.ID, Email: user.Email, Code: code}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(user.Email), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(user.Email, code); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отпра��ить письмо"})
			return
		}

		if err := h.setVerificationCooldown(ctx, user.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Email не подтверждён. Проверьте почту"})
		return
	}

	if err := h.issueTokenPair(c, user.ID, string(user.Role)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	log.Printf("[LOGIN] email=%s ip=%s success=true reason=ok ua=%q", user.Email, c.ClientIP(), c.Request.UserAgent())

	userResp := gin.H{
		"id":          user.ID,
		"email":       user.Email,
		"first_name":  user.FirstName,
		"last_name":   user.LastName,
		"middle_name": user.MiddleName,
		"role":        user.Role,
		"is_verified": user.IsVerified,
	}
	if teacher, err := findLinkedTeacher(h.db, user.ID); err == nil {
		userResp["teacher_id"] = teacher.ID
	}
	c.JSON(http.StatusOK, gin.H{"user": userResp})
}

func (h *AuthHandler) ResendCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	ctx := context.Background()

	cooldown, err := h.getVerificationCooldown(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	if cooldown > 0 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               fmt.Sprintf("Код уже отправлен. Повторите через %d сек.", int(cooldown.Seconds())+1),
			"retry_after_seconds": int(cooldown.Seconds()) + 1,
		})
		return
	}

	var user models.User
	userErr := h.db.Where("email = ?", req.Email).First(&user).Error

	if userErr == nil && user.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email уже подтверждён"})
		return
	}

	// Сценарий 1: pending registration в Redis
	key := registerKey(req.Email)
	raw, err := h.rdb.Get(ctx, key).Result()
	if err == nil {
		var pending PendingRegistration
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		newCode := generateCode()
		pending.Code = newCode

		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if err := h.rdb.Set(ctx, key, data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить письмо"})
			return
		}
		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Код подтверждения отправлен"})
		return
	}
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	// Сценарий 2: pending email verification в Redis
	verifyKey := emailVerificationKey(req.Email)
	raw, err = h.rdb.Get(ctx, verifyKey).Result()
	if err == nil {
		var pending PendingEmailVerification
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		newCode := generateCode()
		pending.Code = newCode
		pending.Attempts = 0

		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if err := h.rdb.Set(ctx, verifyKey, data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить письмо"})
			return
		}
		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Код подтверждения отправлен"})
		return
	}
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	// Сценарий 3: пользователь в БД, email не подтверждён
	if userErr == nil && !user.IsVerified {
		newCode := generateCode()
		pending := PendingEmailVerification{UserID: user.ID, Email: req.Email, Code: newCode}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(req.Email), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить письмо"})
			return
		}
		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Код подтверждения отправлен"})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Заявка на регистрацию не найдена или истекла"})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	ctx := context.Background()
	key := registerKey(req.Email)

	// Сценарий 1: новая регистрация
	raw, err := h.rdb.Get(ctx, key).Result()
	if err == nil {
		var pending PendingRegistration
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		if pending.Attempts >= maxVerificationAttempts {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Превышено количество попыток. Запросите новый код"})
			return
		}

		if pending.Code != req.Code {
			pending.Attempts++
			if updated, err := json.Marshal(pending); err == nil {
				_ = h.rdb.Set(ctx, key, updated, redis.KeepTTL).Err()
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный или истёкший код подтверждения"})
			return
		}

		var existingUser models.User
		if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			_ = h.rdb.Del(ctx, key).Err()
			c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже зарегистрирован"})
			return
		}

		now := time.Now()
		user := models.User{
			Email:          pending.Email,
			Password:       pending.PasswordHash,
			FirstName:      pending.FirstName,
			LastName:       pending.LastName,
			MiddleName:     pending.MiddleName,
			Role:           models.RoleUser,
			IsVerified:     true,
			ConsentGivenAt: &now,
			ConsentVersion: pending.ConsentVersion,
		}
		if err := h.db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать пользователя"})
			return
		}

		_ = h.rdb.Del(ctx, key).Err()
		c.JSON(http.StatusOK, gin.H{"message": "Email успешно подтверждён"})
		return
	}
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	// Сценарий 2: подтверждение email существующего пользователя
	verifyKey := emailVerificationKey(req.Email)
	raw, err = h.rdb.Get(ctx, verifyKey).Result()
	if err == nil {
		var pending PendingEmailVerification
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if pending.Attempts >= maxVerificationAttempts {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Превышено количество попыток. Запросите новый код"})
			return
		}
		if pending.Code != req.Code {
			pending.Attempts++
			if updated, err := json.Marshal(pending); err == nil {
				_ = h.rdb.Set(ctx, verifyKey, updated, redis.KeepTTL).Err()
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный или истёкший код подтверждения"})
			return
		}

		var user models.User
		if err := h.db.First(&user, pending.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
			return
		}

		var existingUser models.User
		if err := h.db.Where("email = ? AND id != ?", pending.Email, pending.UserID).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Попробуйте ввести другую почту"})
			return
		}

		user.Email = pending.Email
		user.IsVerified = true
		if err := h.db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось подтвердить email"})
			return
		}

		_ = h.rdb.Del(ctx, verifyKey).Err()
		c.JSON(http.StatusOK, gin.H{"message": "Email успешно подтверждён"})
		return
	}
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный или истёкший код подтверждения"})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Blacklist the current access token so it can't be reused within its remaining TTL.
	if cookie, err := c.Cookie("token"); err == nil && cookie != "" {
		if claims, err := utils.ValidateToken(cookie, h.cfg.JWTSecret); err == nil {
			if ttl := time.Until(claims.ExpiresAt.Time); ttl > 0 {
				_ = h.rdb.Set(c.Request.Context(), "blacklist:"+cookie, "1", ttl).Err()
			}
		}
	}
	h.clearAuthCookies(c)
	c.JSON(http.StatusOK, gin.H{"message": "Выход выполнен успешно"})
}

// POST /api/refresh
// Issues a new access token + rotates the refresh token.
func (h *AuthHandler) Refresh(c *gin.Context) {
	rt, err := c.Cookie("refresh_token")
	if err != nil || rt == "" {
		log.Printf("[REFRESH] 401 no_cookie ip=%s cookie_err=%v", c.ClientIP(), err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Сессия истекла, войдите снова"})
		return
	}

	ctx := c.Request.Context()
	raw, err := h.rdb.Get(ctx, refreshKey(rt)).Result()
	if err == redis.Nil {
		log.Printf("[REFRESH] 401 not_in_redis ip=%s token=%.8s...", c.ClientIP(), rt)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Сессия истекла, войдите снова"})
		return
	}
	if err != nil {
		log.Printf("[REFRESH] 500 redis_err ip=%s err=%v", c.ClientIP(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	var payload struct {
		UserID uint   `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	// Verify user still exists and is not deleted.
	var user models.User
	if err := h.db.First(&user, payload.UserID).Error; err != nil {
		_ = h.rdb.Del(ctx, refreshKey(rt)).Err()
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
		return
	}

	// Rotate: delete old refresh token and issue a new pair.
	_ = h.rdb.Del(ctx, refreshKey(rt)).Err()
	_ = h.rdb.SRem(ctx, userSessionsKey(payload.UserID), rt).Err()

	if err := h.issueTokenPair(c, user.ID, string(user.Role)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, _ := c.Get("userID")

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	resp := gin.H{
		"id":          user.ID,
		"email":       user.Email,
		"first_name":  user.FirstName,
		"last_name":   user.LastName,
		"middle_name": user.MiddleName,
		"role":        user.Role,
	}

	if teacher, err := findLinkedTeacher(h.db, user.ID); err == nil {
		resp["teacher_id"] = teacher.ID
	}

	c.JSON(http.StatusOK, resp)
}

func passwordResetKey(email string) string {
	return "password_reset:" + strings.ToLower(strings.TrimSpace(email))
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	// Respond immediately with the same message regardless of whether the email exists.
	// Actual work runs in a goroutine to eliminate the timing side-channel.
	c.JSON(http.StatusOK, gin.H{"message": "Если email зарегистрирован, на него отправлен код сброса"})

	email := req.Email
	go func() {
		var user models.User
		if err := h.db.Where("email = ?", email).First(&user).Error; err != nil {
			return
		}

		ctx := context.Background()
		code := generateCode()
		pending := PendingPasswordReset{Code: code, Attempts: 0}

		data, err := json.Marshal(pending)
		if err != nil {
			return
		}
		if err := h.rdb.Set(ctx, passwordResetKey(email), data, 15*time.Minute).Err(); err != nil {
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendPasswordResetCode(email, code); err != nil {
			_ = h.rdb.Del(ctx, passwordResetKey(email)).Err()
		}
	}()
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code"  binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	ctx := context.Background()
	key := passwordResetKey(req.Email)

	raw, err := h.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный или истёкший код"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	var pending PendingPasswordReset
	if err := json.Unmarshal([]byte(raw), &pending); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	if pending.Attempts >= 5 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Превышено количество попыток. Запросите новый код"})
		return
	}

	if pending.Code != req.Code {
		pending.Attempts++
		if updated, err := json.Marshal(pending); err == nil {
			h.rdb.Set(ctx, key, updated, redis.KeepTTL)
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный или истёкший код"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	newPassword := generateRandomPassword()
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	user.Password = string(hashedPassword)
	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить пароль"})
		return
	}

	_ = h.rdb.Del(ctx, key).Err()

	// Password changed → revoke every existing session on all devices.
	revoked := h.invalidateUserSessions(ctx, user.ID)
	log.Printf("[SECURITY] password_reset user=%d email=%s ip=%s sessions_revoked=%d",
		user.ID, user.Email, c.ClientIP(), revoked)

	emailService := services.NewEmailService(h.cfg)
	if err := emailService.SendNewPassword(req.Email, newPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить новый пароль"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Новый пароль отправлен на email"})
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 12)
	max := big.NewInt(int64(len(charset)))
	for i := range b {
		n, _ := crand.Int(crand.Reader, max)
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req struct {
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		MiddleName string `json:"middle_name"`
		Email      string `json:"email"`
		Password   string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные запроса"})
		return
	}

	// Валидация имён
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.MiddleName = strings.TrimSpace(req.MiddleName)

	if req.FirstName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле «имя» обязательно"})
		return
	}
	if req.LastName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле «фамилия» обязательно"})
		return
	}
	if len(req.FirstName) > 100 || len(req.LastName) > 100 || len(req.MiddleName) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Имя, фамилия и отчество не должны превышать 100 символов"})
		return
	}

	// Валидация пароля (если передан)
	if req.Password != "" {
		if err := validatePassword(req.Password); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	emailChanged := false
	newEmail := ""

	user.FirstName = req.FirstName
	user.LastName = req.LastName
	user.MiddleName = req.MiddleName

	if req.Email != "" && req.Email != user.Email {
		var existingUser models.User
		if err := h.db.Where("email = ? AND id != ?", req.Email, userID).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Попробуйте ввести другую почту"})
			return
		}
		emailChanged = true
		newEmail = strings.TrimSpace(req.Email)
	}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		user.Password = string(hashedPassword)
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить профиль"})
		return
	}

	// Password changed in-cabinet → revoke all sessions (log out other devices),
	// then re-issue tokens for THIS device so the current user stays logged in.
	if req.Password != "" {
		sessCtx := context.Background()
		revoked := h.invalidateUserSessions(sessCtx, user.ID)
		_ = h.issueTokenPair(c, user.ID, string(user.Role))
		log.Printf("[SECURITY] password_change user=%d ip=%s sessions_revoked=%d",
			user.ID, c.ClientIP(), revoked)
	}

	if emailChanged {
		ctx := context.Background()
		cooldown, err := h.getVerificationCooldown(ctx, newEmail)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if cooldown > 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":               fmt.Sprintf("Код уже отправлен. Повторите через %d сек.", int(cooldown.Seconds())+1),
				"retry_after_seconds": int(cooldown.Seconds()) + 1,
			})
			return
		}

		code := generateCode()
		pending := PendingEmailVerification{UserID: user.ID, Email: newEmail, Code: code}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(newEmail), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(newEmail, code); err != nil {
			_ = h.rdb.Del(ctx, emailVerificationKey(newEmail)).Err()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отправить письмо"})
			return
		}
		if err := h.setVerificationCooldown(ctx, newEmail); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "Профиль обновлён. Подтвердите новый email",
			"emailChanged": true,
			"email":        newEmail,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Профиль успешно обновлён",
		"user": gin.H{
			"id":          user.ID,
			"email":       user.Email,
			"first_name":  user.FirstName,
			"last_name":   user.LastName,
			"middle_name": user.MiddleName,
			"role":        user.Role,
			"is_verified": user.IsVerified,
		},
	})
}

// DELETE /api/me
// Deletes the authenticated user's account and all their personal data (152-ФЗ right to erasure).
func (h *AuthHandler) DeleteMyAccount(c *gin.Context) {
	userID, _ := c.Get("userID")
	uid := userID.(uint)

	// Capture email for the security log before the record is deleted.
	var acct models.User
	h.db.First(&acct, uid)

	// Delete child doc submissions (files + records)
	var children []models.ChildDocSubmission
	h.db.Where("user_id = ?", uid).Find(&children)
	for _, ch := range children {
		for _, f := range parseFileListAuth(ch.IppsuFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileListAuth(ch.BirthCertFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileListAuth(ch.ChildSnilsFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		h.db.Unscoped().Delete(&ch)
	}

	// Delete parent profile (files + record)
	var profile models.ParentProfile
	if h.db.Where("user_id = ?", uid).First(&profile).Error == nil {
		for _, f := range parseFileListAuth(profile.PassportFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileListAuth(profile.SnilsFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		h.db.Unscoped().Delete(&profile)
	}

	// Delete questionnaire (file + record)
	var q models.Questionnaire
	if h.db.Where("user_id = ?", uid).First(&q).Error == nil {
		if q.FileName != "" {
			_ = os.Remove(filepath.Join(questionnaireDir, q.FileName))
		}
		h.db.Unscoped().Delete(&q)
	}

	// Cascade-delete all related records — mirrors the admin DeleteUser
	// hard-delete so self-deletion and admin deletion behave identically.
	h.db.Unscoped().Where("user_id = ?", uid).Delete(&models.ConsultationRequest{})
	h.db.Unscoped().Where("user_id = ?", uid).Delete(&models.Review{})
	h.db.Unscoped().Where("user_id = ?", uid).Delete(&models.UserStudent{})
	h.db.Unscoped().Where("user_id = ?", uid).Delete(&models.Notification{})

	// Hard-delete the user so the email can be reused immediately.
	h.db.Unscoped().Delete(&models.User{}, uid)

	// Blacklist the current access token + clear both cookies + delete refresh token.
	if cookie, err := c.Cookie("token"); err == nil && cookie != "" {
		if claims, err := utils.ValidateToken(cookie, h.cfg.JWTSecret); err == nil {
			if ttl := time.Until(claims.ExpiresAt.Time); ttl > 0 {
				_ = h.rdb.Set(c.Request.Context(), "blacklist:"+cookie, "1", ttl).Err()
			}
		}
	}
	h.clearAuthCookies(c)
	h.invalidateUserSessions(c.Request.Context(), uid)

	log.Printf("[SECURITY] account_delete user=%d email=%s ip=%s ua=%q",
		uid, acct.Email, c.ClientIP(), c.Request.UserAgent())

	c.JSON(http.StatusOK, gin.H{"message": "Аккаунт и все персональные данные удалены"})
}

// parseFileListAuth parses a JSON array of filenames stored as a string in the DB.
// Mirrors the same helper in documents.go to avoid cross-handler dependency.
func parseFileListAuth(raw string) []string {
	var list []string
	_ = json.Unmarshal([]byte(raw), &list)
	return list
}
