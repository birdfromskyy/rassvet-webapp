package handlers

import (
	"backend/internal/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CmsFileGroupHandler struct {
	db *gorm.DB
}

func NewCmsFileGroupHandler(db *gorm.DB) *CmsFileGroupHandler {
	return &CmsFileGroupHandler{db: db}
}

type CmsFileGroupRequest struct {
	Section   string `json:"section" binding:"required"`
	Title     string `json:"title" binding:"required"`
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

func normalizeCmsFileGroupRequest(req *CmsFileGroupRequest) bool {
	req.Section = strings.TrimSpace(req.Section)
	req.Title = strings.TrimSpace(req.Title)
	return req.Section != "" && req.Title != ""
}

func (h *CmsFileGroupHandler) GetPublicBySection(c *gin.Context) {
	section := c.Query("section")
	if section == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр section обязателен"})
		return
	}

	var groups []models.CmsFileGroup
	if err := h.db.Where("section = ? AND is_active = ?", section, true).
		Preload("Files", func(db *gorm.DB) *gorm.DB {
			return db.Where("section = ? AND is_active = ?", section, true).Order("sort_order ASC, id ASC")
		}).
		Order("sort_order ASC, id ASC").
		Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить разделы"})
		return
	}

	var ungrouped []models.CmsFile
	if err := h.db.Where("section = ? AND is_active = ? AND group_id IS NULL", section, true).
		Order("sort_order ASC, id ASC").
		Find(&ungrouped).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить файлы"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"groups": groups, "ungrouped": ungrouped})
}

func (h *CmsFileGroupHandler) GetAllBySection(c *gin.Context) {
	section := c.Query("section")
	query := h.db.Order("sort_order ASC, id ASC")
	if section != "" {
		query = query.Where("section = ?", section)
	}

	var groups []models.CmsFileGroup
	if err := query.Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить разделы"})
		return
	}
	c.JSON(http.StatusOK, groups)
}

func (h *CmsFileGroupHandler) Create(c *gin.Context) {
	var req CmsFileGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !normalizeCmsFileGroupRequest(&req) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите страницу и название раздела"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	group := models.CmsFileGroup{Section: req.Section, Title: req.Title, SortOrder: req.SortOrder, IsActive: isActive}
	if err := h.db.Create(&group).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Раздел с таким названием уже существует"})
		return
	}
	c.JSON(http.StatusCreated, group)
}

func (h *CmsFileGroupHandler) Update(c *gin.Context) {
	var group models.CmsFileGroup
	if err := h.db.First(&group, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Раздел не найден"})
		return
	}
	var req CmsFileGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !normalizeCmsFileGroupRequest(&req) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите страницу и название раздела"})
		return
	}
	if req.Section != group.Section {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Нельзя перенести раздел в другую страницу"})
		return
	}
	group.Title, group.SortOrder = req.Title, req.SortOrder
	if req.IsActive != nil {
		group.IsActive = *req.IsActive
	}
	if err := h.db.Save(&group).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Раздел с таким названием уже существует"})
		return
	}
	c.JSON(http.StatusOK, group)
}

func (h *CmsFileGroupHandler) Delete(c *gin.Context) {
	var group models.CmsFileGroup
	if err := h.db.First(&group, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Раздел не найден"})
		return
	}
	var count int64
	h.db.Model(&models.CmsFile{}).Where("group_id = ?", group.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Сначала перенесите или открепите файлы этого раздела"})
		return
	}
	if err := h.db.Delete(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
