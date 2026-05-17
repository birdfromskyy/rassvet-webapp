package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CmsFileHandler struct {
	db *gorm.DB
}

func NewCmsFileHandler(db *gorm.DB) *CmsFileHandler {
	return &CmsFileHandler{db: db}
}

type CmsFileRequest struct {
	Section     string `json:"section" binding:"required"` // docs | rules | rating
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	FileURL     string `json:"file_url"`
	SortOrder   int    `json:"sort_order"`
	IsActive    *bool  `json:"is_active"`
}

// GetBySection returns active files for the given section, ordered by sort_order.
func (h *CmsFileHandler) GetBySection(c *gin.Context) {
	section := c.Query("section")
	if section == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "section query param is required"})
		return
	}

	var files []models.CmsFile
	h.db.Where("section = ? AND is_active = ?", section, true).
		Order("sort_order ASC, id ASC").
		Find(&files)

	c.JSON(http.StatusOK, files)
}

// GetAllBySection returns all files (including inactive) for admin.
func (h *CmsFileHandler) GetAllBySection(c *gin.Context) {
	section := c.Query("section")
	query := h.db.Order("sort_order ASC, id ASC")
	if section != "" {
		query = query.Where("section = ?", section)
	}

	var files []models.CmsFile
	query.Find(&files)
	c.JSON(http.StatusOK, files)
}

func (h *CmsFileHandler) CreateFile(c *gin.Context) {
	var req CmsFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	file := models.CmsFile{
		Section:     req.Section,
		Title:       req.Title,
		Description: req.Description,
		FileURL:     req.FileURL,
		SortOrder:   req.SortOrder,
		IsActive:    isActive,
	}

	if err := h.db.Create(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, file)
}

func (h *CmsFileHandler) UpdateFile(c *gin.Context) {
	id := c.Param("id")
	var file models.CmsFile
	if err := h.db.First(&file, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	var req CmsFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file.Section = req.Section
	file.Title = req.Title
	file.Description = req.Description
	file.FileURL = req.FileURL
	file.SortOrder = req.SortOrder
	if req.IsActive != nil {
		file.IsActive = *req.IsActive
	}

	if err := h.db.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, file)
}

func (h *CmsFileHandler) DeleteFile(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.CmsFile{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
