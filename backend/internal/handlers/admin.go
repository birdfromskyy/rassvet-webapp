package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

func (h *AdminHandler) GetAllReviews(c *gin.Context) {
	var reviews []models.Review

	query := h.db.Preload("User")

	// Filter by status if provided
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}

func (h *AdminHandler) GetPendingReviews(c *gin.Context) {
	var reviews []models.Review

	if err := h.db.Preload("User").Where("status = ?", models.StatusPending).Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}

func (h *AdminHandler) UpdateReview(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID отзыва"})
		return
	}

	var req struct {
		Content string `json:"content"`
		Rating  int    `json:"rating" binding:"min=1,max=5"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var review models.Review
	if err := h.db.First(&review, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Отзыв не найден"})
		return
	}

	review.Content = req.Content
	review.Rating = req.Rating

	if err := h.db.Save(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить отзыв"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Review updated successfully",
		"review":  review,
	})
}

func (h *AdminHandler) DeleteReview(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID отзыва"})
		return
	}

	if err := h.db.Delete(&models.Review{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить отзыв"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Review deleted successfully"})
}

func (h *AdminHandler) ApproveReview(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID отзыва"})
		return
	}

	var review models.Review
	if err := h.db.First(&review, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Отзыв не найден"})
		return
	}

	review.Status = models.StatusApproved

	if err := h.db.Save(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Review approved successfully",
		"review":  review,
	})
}

func (h *AdminHandler) RejectReview(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID отзыва"})
		return
	}

	var review models.Review
	if err := h.db.First(&review, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Отзыв не найден"})
		return
	}

	review.Status = models.StatusRejected

	if err := h.db.Save(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Review rejected successfully",
		"review":  review,
	})
}
