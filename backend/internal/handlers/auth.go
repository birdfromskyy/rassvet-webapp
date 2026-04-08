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
}

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

	ctx := context.Background()
	key := "register:" + req.Email

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
	// Check if verified
	if !user.IsVerified {
		// Удаляем старые неиспользованные коды для этого email
		h.db.Where("email = ? AND used = false", user.Email).Delete(&models.VerificationCode{})

		// Генерируем новый код
		code := fmt.Sprintf("%06d", rand.Intn(1000000))
		verificationCode := models.VerificationCode{
			Email:     user.Email,
			Code:      code,
			ExpiresAt: time.Now().Add(15 * time.Minute),
			Used:      false,
		}

		if err := h.db.Create(&verificationCode).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification code"})
			return
		}

		// Отправляем код на почту
		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(user.Email, code); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
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

	// Сначала проверяем, есть ли пользователь в БД
	var user models.User
	userErr := h.db.Where("email = ?", req.Email).First(&user).Error

	// Если пользователь найден и уже подтвержден — повторно код не отправляем
	if userErr == nil && user.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already verified"})
		return
	}

	// Сценарий 1: pending registration в Redis
	key := "register:" + req.Email
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

		c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
		return
	}

	// Если ошибка Redis не Nil — это уже реальная ошибка Redis
	if err != nil && err != redis.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load registration data"})
		return
	}

	// Сценарий 2: пользователь есть в БД, но email не подтвержден
	if userErr == nil && !user.IsVerified {
		newCode := fmt.Sprintf("%06d", rand.Intn(1000000))

		resetCode := models.VerificationCode{
			Email:     req.Email,
			Code:      newCode,
			ExpiresAt: time.Now().Add(15 * time.Minute),
			Used:      false,
		}

		// Удаляем старые неподтвержденные коды для этого email
		h.db.Where("email = ? AND used = false", req.Email).Delete(&models.VerificationCode{})

		if err := h.db.Create(&resetCode).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification code"})
			return
		}

		emailService := services.NewEmailService(h.cfg)
		if err := emailService.SendVerificationCode(req.Email, newCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
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
	key := "register:" + req.Email

	// Сценарий 1: новая регистрация через Redis
	raw, err := h.rdb.Get(ctx, key).Result()
	if err == nil {
		var pending PendingRegistration
		if err := json.Unmarshal([]byte(raw), &pending); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse verification data"})
			return
		}

		if pending.Code != req.Code {
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

	// Сценарий 2: подтверждение новой почты у уже существующего пользователя
	var verificationCode models.VerificationCode
	if err := h.db.Where("email = ? AND code = ? AND used = false", req.Email, req.Code).First(&verificationCode).Error; err == nil {
		if time.Now().After(verificationCode.ExpiresAt) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Code has expired"})
			return
		}

		var user models.User
		if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		user.IsVerified = true
		if err := h.db.Save(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
			return
		}

		verificationCode.Used = true
		_ = h.db.Save(&verificationCode).Error

		c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
}

func (h *AuthHandler) Logout(c *gin.Context) {
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

	// Удаляем старые неиспользованные коды
	h.db.Where("email = ? AND used = false", req.Email).Delete(&models.PasswordResetCode{})

	// Генерируем новый код
	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	resetCode := models.PasswordResetCode{
		Email:     req.Email,
		Code:      code,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		Attempts:  0,
	}

	if err := h.db.Create(&resetCode).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reset code"})
		return
	}

	// Отправляем email
	emailService := services.NewEmailService(h.cfg)
	err := emailService.SendPasswordResetCode(req.Email, code)
	if err != nil {
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

	// Находим код
	var resetCode models.PasswordResetCode
	if err := h.db.Where("email = ? AND code = ? AND used = false", req.Email, req.Code).First(&resetCode).Error; err != nil {
		// Увеличиваем счетчик попыток для всех кодов этого email
		h.db.Model(&models.PasswordResetCode{}).
			Where("email = ? AND used = false", req.Email).
			Update("attempts", gorm.Expr("attempts + 1"))

		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}

	// Проверяем количество попыток
	if resetCode.Attempts >= 5 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Please request a new code"})
		return
	}

	// Проверяем срок действия
	if time.Now().After(resetCode.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code has expired"})
		return
	}

	// Генерируем новый пароль
	newPassword := generateRandomPassword()
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}

	// Обновляем пароль пользователя
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Password = string(hashedPassword)
	h.db.Save(&user)

	// Помечаем код как использованный
	resetCode.Used = true
	h.db.Save(&resetCode)

	// Отправляем новый пароль на email
	emailService := services.NewEmailService(h.cfg)
	err = emailService.SendNewPassword(req.Email, newPassword)
	if err != nil {
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
		user.Email = req.Email
		user.IsVerified = false // Требуется повторная верификация
		emailChanged = true
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
		c.JSON(http.StatusOK, gin.H{
			"message":      "Profile updated. Please verify your new email",
			"emailChanged": true,
			"email":        user.Email,
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
