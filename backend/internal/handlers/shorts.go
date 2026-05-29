package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ShortHandler struct{ db *gorm.DB }

func NewShortHandler(db *gorm.DB) *ShortHandler { return &ShortHandler{db: db} }

// GET /api/shorts — public, active only ordered by sort_order
func (h *ShortHandler) GetPublic(c *gin.Context) {
	var items []models.VideoShort
	h.db.Where("is_active = true").Order("sort_order ASC, id ASC").Find(&items)
	if items == nil {
		items = []models.VideoShort{}
	}
	c.JSON(http.StatusOK, items)
}

// GET /api/admin/shorts — all
func (h *ShortHandler) GetAll(c *gin.Context) {
	var items []models.VideoShort
	h.db.Order("sort_order ASC, id ASC").Find(&items)
	if items == nil {
		items = []models.VideoShort{}
	}
	c.JSON(http.StatusOK, items)
}

// POST /api/admin/shorts
func (h *ShortHandler) Create(c *gin.Context) {
	var body models.VideoShort
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&body)
	c.JSON(http.StatusCreated, body)
}

// PUT /api/admin/shorts/:id
func (h *ShortHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.VideoShort
	if err := h.db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	var body models.VideoShort
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.Title = body.Title
	item.CoverURL = body.CoverURL
	item.VideoURL = body.VideoURL
	item.SortOrder = body.SortOrder
	item.IsActive = body.IsActive
	h.db.Save(&item)
	c.JSON(http.StatusOK, item)
}

// DELETE /api/admin/shorts/:id
func (h *ShortHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	h.db.Delete(&models.VideoShort{}, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
