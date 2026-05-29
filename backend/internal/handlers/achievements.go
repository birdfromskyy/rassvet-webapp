package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AchievementHandler struct{ db *gorm.DB }

func NewAchievementHandler(db *gorm.DB) *AchievementHandler {
	return &AchievementHandler{db: db}
}

// GET /api/achievements — public, only visible ones
func (h *AchievementHandler) GetPublic(c *gin.Context) {
	var list []models.Achievement
	h.db.Where("is_visible = true").Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// GET /api/admin/achievements
func (h *AchievementHandler) GetAll(c *gin.Context) {
	var list []models.Achievement
	h.db.Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// POST /api/admin/achievements
func (h *AchievementHandler) Create(c *gin.Context) {
	var body models.Achievement
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&body)
	c.JSON(http.StatusCreated, body)
}

// PUT /api/admin/achievements/:id
func (h *AchievementHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.Achievement
	if err := h.db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.ID = uint(id)
	h.db.Save(&item)
	c.JSON(http.StatusOK, item)
}

// DELETE /api/admin/achievements/:id
func (h *AchievementHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	h.db.Delete(&models.Achievement{}, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
