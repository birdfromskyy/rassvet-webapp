package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReviewHandler struct {
	db *gorm.DB
}

func NewReviewHandler(db *gorm.DB) *ReviewHandler {
	return &ReviewHandler{db: db}
}

type CreateReviewRequest struct {
	Rating      int    `json:"rating" binding:"required,min=1,max=5"`
	Content     string `json:"content" binding:"required"`
	IsAnonymous bool   `json:"is_anonymous"`
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	if role == string(models.RoleTeacher) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Преподаватели не могут оставлять отзывы"})
		return
	}

	// Проверяем, есть ли у пользователя существующий отзыв
	var existingReview models.Review
	err := h.db.Where("user_id = ? AND status IN ?", userID.(uint), []models.ReviewStatus{
		models.StatusPending,
		models.StatusApproved,
	}).First(&existingReview).Error

	if err == nil {
		// У пользователя уже есть активный отзыв
		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "У вас уже есть отзыв. Вы можете его изменить на странице 'Мои отзывы'",
			"hasReview":    true,
			"reviewStatus": existingReview.Status,
		})
		return
	}

	uid := userID.(uint)
	review := models.Review{
		UserID:      &uid,
		Rating:      req.Rating,
		Content:     req.Content,
		IsAnonymous: req.IsAnonymous,
		Status:      models.StatusPending,
	}

	if err := h.db.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать отзыв"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Review submitted for moderation",
		"review":  review,
	})
}

// Добавляем новый метод для обновления отзыва пользователем
func (h *ReviewHandler) UpdateMyReview(c *gin.Context) {
	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	if role == string(models.RoleTeacher) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Преподаватели не могут оставлять отзывы"})
		return
	}

	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var review models.Review
	if err := h.db.Where("user_id = ?", userID).First(&review).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Отзыв не найден"})
		return
	}

	// Обновляем отзыв и меняем статус на pending
	review.Rating = req.Rating
	review.Content = req.Content
	review.IsAnonymous = req.IsAnonymous
	review.Status = models.StatusPending

	if err := h.db.Save(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить отзыв"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Review updated and sent for moderation",
		"review":  review,
	})
}

// Проверка наличия отзыва у пользователя
func (h *ReviewHandler) CheckUserReview(c *gin.Context) {
	userID, _ := c.Get("userID")

	var review models.Review
	err := h.db.Where("user_id = ?", userID).First(&review).Error

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"hasReview": false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hasReview": true,
		"review":    review,
		"canEdit":   review.Status != models.StatusRejected,
	})
}

// AdminCreateReview — creates an external review on behalf of admin (auto-approved).
func (h *ReviewHandler) AdminCreateReview(c *gin.Context) {
	var req struct {
		AuthorName     string `json:"author_name" binding:"required"`
		SourcePlatform string `json:"source_platform"`
		Rating         int    `json:"rating" binding:"required,min=1,max=5"`
		Content        string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	review := models.Review{
		AdminAuthorName: req.AuthorName,
		SourcePlatform:  req.SourcePlatform,
		Rating:          req.Rating,
		Content:         req.Content,
		Status:          models.StatusApproved,
	}

	if err := h.db.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать отзыв"})
		return
	}

	review.AuthorName = review.AdminAuthorName
	c.JSON(http.StatusCreated, review)
}

func (h *ReviewHandler) GetPublishedReviews(c *gin.Context) {
	var reviews []models.Review

	if err := h.db.Preload("User").Where("status = ?", models.StatusApproved).Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения отзывов"})
		return
	}

	for i := range reviews {
		if reviews[i].UserID == nil {
			// External admin-created review
			reviews[i].AuthorName = reviews[i].AdminAuthorName
		} else if reviews[i].IsAnonymous || reviews[i].User.ID == 0 {
			reviews[i].AuthorName = "Анонимный пользователь"
		} else {
			lastNameRunes := []rune(reviews[i].User.LastName)
			if len(lastNameRunes) > 0 {
				reviews[i].AuthorName = reviews[i].User.FirstName + " " + string(lastNameRunes[0]) + "."
			} else {
				reviews[i].AuthorName = reviews[i].User.FirstName
			}
		}
		reviews[i].User = models.User{}
	}

	c.JSON(http.StatusOK, reviews)
}

func (h *ReviewHandler) GetMyReviews(c *gin.Context) {
	userID, _ := c.Get("userID")

	var reviews []models.Review
	if err := h.db.Where("user_id = ?", userID).Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения отзывов"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}
