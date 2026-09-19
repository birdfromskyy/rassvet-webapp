package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ServiceCmsHandler struct {
	db *gorm.DB
}

func NewServiceCmsHandler(db *gorm.DB) *ServiceCmsHandler {
	return &ServiceCmsHandler{db: db}
}

type ServiceItemRequest struct {
	ParentID  *uint  `json:"parent_id"`
	Type      string `json:"type"`
	Title     string `json:"title" binding:"required"`
	Text      string `json:"text"`
	Items     string `json:"items"` // JSON array string
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

// GetServices returns active services, optionally filtered by ?type=
func (h *ServiceCmsHandler) GetServices(c *gin.Context) {
	var services []models.ServiceItem
	q := h.db.Where("is_active = ?", true)
	if t := c.Query("type"); t != "" {
		q = q.Where("type = ?", t)
	}
	q.Order("sort_order ASC, id ASC").Find(&services)
	c.JSON(http.StatusOK, services)
}

// GetAllServices returns all services (admin), optionally filtered by ?type=
func (h *ServiceCmsHandler) GetAllServices(c *gin.Context) {
	var services []models.ServiceItem
	q := h.db
	if t := c.Query("type"); t != "" {
		q = q.Where("type = ?", t)
	}
	q.Order("sort_order ASC, id ASC").Find(&services)
	c.JSON(http.StatusOK, services)
}

func (h *ServiceCmsHandler) CreateService(c *gin.Context) {
	var req ServiceItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	serviceType := req.Type
	if serviceType == "" {
		serviceType = "services_list"
	}

	service := models.ServiceItem{
		ParentID:  req.ParentID,
		Type:      serviceType,
		Title:     req.Title,
		Text:      req.Text,
		Items:     req.Items,
		SortOrder: req.SortOrder,
		IsActive:  isActive,
	}

	if err := h.db.Create(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, service)
}

func (h *ServiceCmsHandler) UpdateService(c *gin.Context) {
	id := c.Param("id")
	var service models.ServiceItem
	if err := h.db.First(&service, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Услуга не найдена"})
		return
	}

	var req ServiceItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service.ParentID = req.ParentID
	if req.Type != "" {
		service.Type = req.Type
	}
	service.Title = req.Title
	service.Text = req.Text
	service.Items = req.Items
	service.SortOrder = req.SortOrder
	if req.IsActive != nil {
		service.IsActive = *req.IsActive
	}

	if err := h.db.Save(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, service)
}

func (h *ServiceCmsHandler) DeleteService(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.ServiceItem{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
