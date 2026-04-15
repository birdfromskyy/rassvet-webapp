package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SubjectHandler struct {
	db *gorm.DB
}

func NewSubjectHandler(db *gorm.DB) *SubjectHandler {
	return &SubjectHandler{db: db}
}

type CreateSubjectRequest struct {
	Name               string `json:"name" binding:"required"`
	DefaultDurationMin int    `json:"default_duration_min" binding:"required"`
	IsActive           *bool  `json:"is_active"`
}

type UpdateSubjectRequest struct {
	Name               string `json:"name"`
	DefaultDurationMin *int   `json:"default_duration_min"`
	IsActive           *bool  `json:"is_active"`
}

func (h *SubjectHandler) GetSubjects(c *gin.Context) {
	var subjects []models.Subject

	query := h.db.Order("id ASC")

	// Опциональный фильтр по активности: ?is_active=true/false
	if isActive := c.Query("is_active"); isActive != "" {
		switch strings.ToLower(isActive) {
		case "true":
			query = query.Where("is_active = ?", true)
		case "false":
			query = query.Where("is_active = ?", false)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid is_active value"})
			return
		}
	}

	if err := query.Find(&subjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subjects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subjects": subjects})
}

func (h *SubjectHandler) GetSubjectByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subject id"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subject not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subject"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subject": subject})
}

func (h *SubjectHandler) CreateSubject(c *gin.Context) {
	var req CreateSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
		return
	}

	if req.DefaultDurationMin != 30 && req.DefaultDurationMin != 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "default_duration_min must be 30 or 50"})
		return
	}

	var existing models.Subject
	if err := h.db.Where("LOWER(name) = LOWER(?)", req.Name).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Subject with this name already exists"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check subject uniqueness"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	subject := models.Subject{
		Name:               req.Name,
		DefaultDurationMin: req.DefaultDurationMin,
		IsActive:           isActive,
	}

	if err := h.db.Create(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subject"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Subject created successfully",
		"subject": subject,
	})
}

func (h *SubjectHandler) UpdateSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subject id"})
		return
	}

	var req UpdateSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subject not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subject"})
		return
	}

	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Name cannot be empty"})
			return
		}

		var existing models.Subject
		if err := h.db.Where("LOWER(name) = LOWER(?) AND id <> ?", req.Name, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Subject with this name already exists"})
			return
		} else if err != nil && err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check subject uniqueness"})
			return
		}

		subject.Name = req.Name
	}

	if req.DefaultDurationMin != nil {
		if *req.DefaultDurationMin != 30 && *req.DefaultDurationMin != 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "default_duration_min must be 30 or 50"})
			return
		}
		subject.DefaultDurationMin = *req.DefaultDurationMin
	}

	if req.IsActive != nil {
		subject.IsActive = *req.IsActive
	}

	if err := h.db.Save(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subject"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subject updated successfully",
		"subject": subject,
	})
}

func (h *SubjectHandler) DeleteSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subject id"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subject not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subject"})
		return
	}

	// Мягкое удаление через деактивацию
	subject.IsActive = false

	if err := h.db.Save(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate subject"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subject deactivated successfully",
		"subject": subject,
	})
}
