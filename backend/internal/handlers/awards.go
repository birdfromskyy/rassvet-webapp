package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AwardHandler struct{ db *gorm.DB }

func NewAwardHandler(db *gorm.DB) *AwardHandler { return &AwardHandler{db: db} }

// GET /api/awards — public
func (h *AwardHandler) GetPublic(c *gin.Context) {
	var list []models.Award
	h.db.Where("is_visible = true").Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// GET /api/admin/awards
func (h *AwardHandler) GetAll(c *gin.Context) {
	var list []models.Award
	h.db.Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// POST /api/admin/awards
func (h *AwardHandler) Create(c *gin.Context) {
	var body models.Award
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&body)
	c.JSON(http.StatusCreated, body)
}

// PUT /api/admin/awards/:id
func (h *AwardHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.Award
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

// DELETE /api/admin/awards/:id
func (h *AwardHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	h.db.Delete(&models.Award{}, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
