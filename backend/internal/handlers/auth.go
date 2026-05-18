package handlers

import (
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/services"
	"backend/internal/utils"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	MiddleName   string `json:"middle_name"`
	Code         string `json:"code"`
	Attempts     int    `json:"attempts"`
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

func NewAuthHandler(db *gorm.DB, rdb *redis.Client, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		db:  db,
		rdb: rdb,
		cfg: cfg,
	}
}

type RegisterRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
	FirstName  string `json:"first_name" binding:"required"`
	LastName   string `json:"last_name" binding:"required"`
	MiddleName string `json:"middle_name"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем, есть ли уже подтвержденный/созданный пользователь
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	ctx := context.Background()

	cooldown, err := h.getVerificationCooldown(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check resend cooldown"})
		return
	}

	if cooldown > 0 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               fmt.Sprintf("Verification code was sent recently. Try again in %d seconds", int(cooldown.Seconds())+1),
			"retry_after_seconds": int(cooldown.Seconds()) + 1,
		})
		return
	}

	// Хэшируем пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Генерируем код
	code := fmt.Sprintf("%06d", rand.Intn(1000000))

	pending := PendingRegistration{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		MiddleName:   req.MiddleName,
		Code:         code,
	}

	data, err := json.Marshal(pending)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare registration data"})
		return
	}

	key := registerKey(req.Email)

	// Сохраняем в Redis на 15 минут
	if err := h.rdb.Set(ctx, key, data, 15*time.Minute).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification data"})
		return
	}

	// Отправляем email
	emailService := services.NewEmailService(h.cfg)
	if err := emailService.SendVerificationCode(req.Email, code); err != nil {
		_ = h.rdb.Del(ctx, key).Err()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Verification code sent. Please check your email.",
		"email":   req.Email,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check if verified
	if !user.IsVerified {
		ctx := context.Background()

		cooldown, err := h.getVerificationCooldown(ctx, user.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check resend cooldown"})
			return
		}

		if cooldown > 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"error":               "Email not verified",
				"message":             fmt.Sprintf("Verification code was sent recently. Try again in %d seconds", int(cooldown.Seconds())+1),
				"retry_after_seconds": int(cooldown.Seconds()) + 1,
				"email":               user.Email,
			})
			return
		}

		code := fmt.Sprintf("%06d", rand.Intn(1000000))
		pending := PendingEmailVerification{UserID: user.ID, Email: user.Email, Code: code}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare verification data"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(user.Email), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification code"})
			return
		}

		// Отправляем код на почту
		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(user.Email, code); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		if err := h.setVerificationCooldown(ctx, user.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Email not verified"})
		return
	}

	// Generate token
	token, err := utils.GenerateToken(user.ID, string(user.Role), h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
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

func (h *AuthHandler) ResendCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()

	cooldown, err := h.getVerificationCooldown(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check resend cooldown"})
		return
	}

	if cooldown > 0 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               fmt.Sprintf("Verification code was sent recently. Try again in %d seconds", int(cooldown.Seconds())+1),
			"retry_after_seconds": int(cooldown.Seconds()) + 1,
		})
		return
	}

	// Сначала проверяем, есть ли пользователь в БД
	var user models.User
	userErr := h.db.Where("email = ?", req.Email).First(&user).Error

	// Если пользователь найден и уже подтвержден — повторно код не отправляем
	if userErr == nil && user.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already verified"})
		return
	}

	// Сценарий 1: pending registration в Redis
	key := registerKey(req.Email)
	raw, err := h.rdb.Get(ctx, key).Result()
	if err == nil {
		var pending PendingRegistration
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse registration data"})
			return
		}

		newCode := fmt.Sprintf("%06d", rand.Intn(1000000))
		pending.Code = newCode

		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare registration data"})
			return
		}

		if err := h.rdb.Set(ctx, key, data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update verification data"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
		return
	}

	// Если ошибка Redis не Nil — это уже реальная ошибка Redis
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load registration data"})
		return
	}

	verifyKey := emailVerificationKey(req.Email)
	raw, err = h.rdb.Get(ctx, verifyKey).Result()
	if err == nil {
		var pending PendingEmailVerification
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse verification data"})
			return
		}

		newCode := fmt.Sprintf("%06d", rand.Intn(1000000))
		pending.Code = newCode
		pending.Attempts = 0

		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare verification data"})
			return
		}
		if err := h.rdb.Set(ctx, verifyKey, data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update verification data"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
		return
	}

	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load verification data"})
		return
	}

	// Сценарий 2: пользователь есть в БД, но email не подтвержден
	if userErr == nil && !user.IsVerified {
		newCode := fmt.Sprintf("%06d", rand.Intn(1000000))

		pending := PendingEmailVerification{UserID: user.ID, Email: req.Email, Code: newCode}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare verification data"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(req.Email), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification code"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		if err := h.setVerificationCooldown(ctx, req.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Registration request not found or expired"})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	key := registerKey(req.Email)

	// Сценарий 1: новая регистрация через Redis
	raw, err := h.rdb.Get(ctx, key).Result()
	if err == nil {
		var pending PendingRegistration
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse verification data"})
			return
		}

		if pending.Attempts >= maxVerificationAttempts {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Please request a new code"})
			return
		}

		if pending.Code != req.Code {
			pending.Attempts++
			if updated, err := json.Marshal(pending); err == nil {
				_ = h.rdb.Set(ctx, key, updated, redis.KeepTTL).Err()
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
			return
		}

		var existingUser models.User
		if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			_ = h.rdb.Del(ctx, key).Err()
			c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
			return
		}

		user := models.User{
			Email:      pending.Email,
			Password:   pending.PasswordHash,
			FirstName:  pending.FirstName,
			LastName:   pending.LastName,
			MiddleName: pending.MiddleName,
			Role:       models.RoleUser,
			IsVerified: true,
		}

		if err := h.db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		_ = h.rdb.Del(ctx, key).Err()

		c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
		return
	}

	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load verification data"})
		return
	}

	// Сценарий 2: подтверждение почты у уже существующего пользователя через Redis
	verifyKey := emailVerificationKey(req.Email)
	raw, err = h.rdb.Get(ctx, verifyKey).Result()
	if err == nil {
		var pending PendingEmailVerification
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse verification data"})
			return
		}
		if pending.Attempts >= maxVerificationAttempts {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Please request a new code"})
			return
		}
		if pending.Code != req.Code {
			pending.Attempts++
			if updated, err := json.Marshal(pending); err == nil {
				_ = h.rdb.Set(ctx, verifyKey, updated, redis.KeepTTL).Err()
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
			return
		}

		var user models.User
		if err := h.db.First(&user, pending.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		var existingUser models.User
		if err := h.db.Where("email = ? AND id != ?", pending.Email, pending.UserID).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
			return
		}

		user.Email = pending.Email
		user.IsVerified = true
		if err := h.db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
			return
		}

		_ = h.rdb.Del(ctx, verifyKey).Err()

		c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
		return
	}
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load verification data"})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if claims, err := utils.ValidateToken(tokenString, h.cfg.JWTSecret); err == nil {
			ttl := time.Until(claims.ExpiresAt.Time)
			if ttl > 0 {
				_ = h.rdb.Set(context.Background(), "blacklist:"+tokenString, "1", ttl).Err()
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, _ := c.Get("userID")

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          user.ID,
		"email":       user.Email,
		"first_name":  user.FirstName,
		"last_name":   user.LastName,
		"middle_name": user.MiddleName,
		"role":        user.Role,
	})
}

func passwordResetKey(email string) string {
	return "password_reset:" + strings.ToLower(strings.TrimSpace(email))
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем существует ли пользователь
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Не раскрываем информацию о существовании email
		c.JSON(http.StatusOK, gin.H{"message": "If email exists, reset code has been sent"})
		return
	}

	ctx := context.Background()

	// Генерируем новый код и сохраняем в Redis (перезаписывает предыдущий, если был)
	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	pending := PendingPasswordReset{Code: code, Attempts: 0}

	data, err := json.Marshal(pending)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare reset data"})
		return
	}

	if err := h.rdb.Set(ctx, passwordResetKey(req.Email), data, 15*time.Minute).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save reset code"})
		return
	}

	// Отправляем email
	emailService := services.NewEmailService(h.cfg)
	if err := emailService.SendPasswordResetCode(req.Email, code); err != nil {
		_ = h.rdb.Del(ctx, passwordResetKey(req.Email)).Err()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Reset code sent to email"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	key := passwordResetKey(req.Email)

	raw, err := h.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load reset data"})
		return
	}

	var pending PendingPasswordReset
	if err := json.Unmarshal([]byte(raw), &pending); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse reset data"})
		return
	}

	if pending.Attempts >= 5 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Please request a new code"})
		return
	}

	if pending.Code != req.Code {
		pending.Attempts++
		if updated, err := json.Marshal(pending); err == nil {
			h.rdb.Set(ctx, key, updated, redis.KeepTTL)
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	newPassword := generateRandomPassword()
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}

	user.Password = string(hashedPassword)
	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	_ = h.rdb.Del(ctx, key).Err()

	emailService := services.NewEmailService(h.cfg)
	if err := emailService.SendNewPassword(req.Email, newPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send new password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "New password sent to email"})
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// Методы для профиля
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Флаг для отслеживания смены email
	emailChanged := false
	newEmail := ""

	// Обновляем имя и фамилию только для админов
	user.FirstName = req.FirstName
	user.LastName = req.LastName
	user.MiddleName = req.MiddleName

	// Обновляем email
	if req.Email != "" && req.Email != user.Email {
		// Проверяем, не занят ли email
		var existingUser models.User
		if err := h.db.Where("email = ? AND id != ?", req.Email, userID).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
			return
		}
		emailChanged = true
		newEmail = strings.TrimSpace(req.Email)
	}

	// Обновляем пароль
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.Password = string(hashedPassword)
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Если email изменен, требуем повторную авторизацию
	if emailChanged {
		ctx := context.Background()
		cooldown, err := h.getVerificationCooldown(ctx, newEmail)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check resend cooldown"})
			return
		}
		if cooldown > 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":               fmt.Sprintf("Verification code was sent recently. Try again in %d seconds", int(cooldown.Seconds())+1),
				"retry_after_seconds": int(cooldown.Seconds()) + 1,
			})
			return
		}

		code := fmt.Sprintf("%06d", rand.Intn(1000000))
		pending := PendingEmailVerification{UserID: user.ID, Email: newEmail, Code: code}
		data, err := json.Marshal(pending)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare verification data"})
			return
		}
		if err := h.rdb.Set(ctx, emailVerificationKey(newEmail), data, 15*time.Minute).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save verification code"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(newEmail, code); err != nil {
			_ = h.rdb.Del(ctx, emailVerificationKey(newEmail)).Err()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}
		if err := h.setVerificationCooldown(ctx, newEmail); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save resend cooldown"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "Profile updated. Please verify your new email",
			"emailChanged": true,
			"email":        newEmail,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
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
