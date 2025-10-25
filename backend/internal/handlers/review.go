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

	review := models.Review{
		UserID:      userID.(uint),
		Rating:      req.Rating,
		Content:     req.Content,
		IsAnonymous: req.IsAnonymous,
		Status:      models.StatusPending,
	}

	if err := h.db.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Review submitted for moderation",
		"review":  review,
	})
}

func (h *ReviewHandler) GetPublishedReviews(c *gin.Context) {
	var reviews []models.Review

	if err := h.db.Preload("User").Where("status = ?", models.StatusApproved).Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}

	// Process author names
	for i := range reviews {
		if !reviews[i].IsAnonymous && reviews[i].User.ID != 0 {
			if reviews[i].User.LastName != "" {
				reviews[i].AuthorName = reviews[i].User.FirstName + " " + string(reviews[i].User.LastName[0]) + "."
			} else {
				reviews[i].AuthorName = reviews[i].User.FirstName
			}
		} else {
			reviews[i].AuthorName = "Анонимный пользователь"
		}
		// Clear user data from response
		reviews[i].User = models.User{}
	}

	c.JSON(http.StatusOK, reviews)
}

func (h *ReviewHandler) GetMyReviews(c *gin.Context) {
	userID, _ := c.Get("userID")

	var reviews []models.Review
	if err := h.db.Where("user_id = ?", userID).Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}
