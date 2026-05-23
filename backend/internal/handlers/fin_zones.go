package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FinZoneHandler struct {
	db *gorm.DB
}

func NewFinZoneHandler(db *gorm.DB) *FinZoneHandler {
	return &FinZoneHandler{db: db}
}

type FinZoneRequest struct {
	Title     string `json:"title" binding:"required"`
	Accent    string `json:"accent"`
	Text      string `json:"text"`
	ImageURL  string `json:"image_url"`
	Items     string `json:"items"` // JSON array string
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

func (h *FinZoneHandler) GetFinZones(c *gin.Context) {
	var zones []models.FinZone
	h.db.Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&zones)
	c.JSON(http.StatusOK, zones)
}

func (h *FinZoneHandler) GetAllFinZones(c *gin.Context) {
	var zones []models.FinZone
	h.db.Order("sort_order ASC, id ASC").Find(&zones)
	c.JSON(http.StatusOK, zones)
}

func (h *FinZoneHandler) CreateFinZone(c *gin.Context) {
	var req FinZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	zone := models.FinZone{
		Title:     req.Title,
		Accent:    req.Accent,
		Text:      req.Text,
		ImageURL:  req.ImageURL,
		Items:     req.Items,
		SortOrder: req.SortOrder,
		IsActive:  isActive,
	}

	if err := h.db.Create(&zone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, zone)
}

func (h *FinZoneHandler) UpdateFinZone(c *gin.Context) {
	id := c.Param("id")
	var zone models.FinZone
	if err := h.db.First(&zone, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Финансовая зона не найдена"})
		return
	}

	var req FinZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	zone.Title = req.Title
	zone.Accent = req.Accent
	zone.Text = req.Text
	zone.ImageURL = req.ImageURL
	zone.Items = req.Items
	zone.SortOrder = req.SortOrder
	if req.IsActive != nil {
		zone.IsActive = *req.IsActive
	}

	if err := h.db.Save(&zone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, zone)
}

func (h *FinZoneHandler) DeleteFinZone(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.FinZone{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
