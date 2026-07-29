package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	Name                       string `json:"name" binding:"required"`
	DefaultDurationMin         int    `json:"default_duration_min" binding:"required"`
	MinimumTeacherBreakMinutes int    `json:"minimum_teacher_break_minutes"`
	IsActive                   *bool  `json:"is_active"`
}

type UpdateSubjectRequest struct {
	Name                       string `json:"name"`
	DefaultDurationMin         *int   `json:"default_duration_min"`
	MinimumTeacherBreakMinutes *int   `json:"minimum_teacher_break_minutes"`
	IsActive                   *bool  `json:"is_active"`
}

func validMinimumTeacherBreak(minutes int) bool {
	return minutes == 5 || minutes == 10
}

func (h *SubjectHandler) GetSubjects(c *gin.Context) {
	var subjects []models.Subject

	query := h.db.Order("id ASC")
	if c.Query("archived") == "true" {
		query = query.Where("archived_at IS NOT NULL")
	} else {
		query = query.Where("archived_at IS NULL")
	}

	// Опциональный фильтр по активности: ?is_active=true/false
	if isActive := c.Query("is_active"); isActive != "" {
		switch strings.ToLower(isActive) {
		case "true":
			query = query.Where("is_active = ?", true)
		case "false":
			query = query.Where("is_active = ?", false)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное значение параметра is_active"})
			return
		}
	}

	if err := query.Find(&subjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subjects": subjects})
}

func (h *SubjectHandler) GetSubjectByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Предмет не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле «название» обязательно"})
		return
	}

	if req.DefaultDurationMin != 30 && req.DefaultDurationMin != 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Длительность занятия по умолчанию должна быть 30 или 50 минут"})
		return
	}
	if req.MinimumTeacherBreakMinutes == 0 {
		req.MinimumTeacherBreakMinutes = 10
	}
	if !validMinimumTeacherBreak(req.MinimumTeacherBreakMinutes) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Минимальный перерыв преподавателя должен быть 5 или 10 минут"})
		return
	}

	var existing models.Subject
	if err := h.db.Where("LOWER(name) = LOWER(?)", req.Name).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Предмет с таким названием уже существует"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	subject := models.Subject{
		Name:                       req.Name,
		DefaultDurationMin:         req.DefaultDurationMin,
		MinimumTeacherBreakMinutes: req.MinimumTeacherBreakMinutes,
		IsActive:                   isActive,
	}

	if err := h.db.Select("Name", "DefaultDurationMin", "MinimumTeacherBreakMinutes", "IsActive").Create(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать предмет"})
		return
	}

	// GORM uses DEFAULT for zero bool values even with Select() when field has gorm:"default:true".
	// Explicitly update is_active to false if needed.
	if !isActive {
		if err := h.db.Model(&subject).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать предмет"})
			return
		}
		subject.IsActive = false
	}
	logging.AdminMutation(c, "schedule.subject.create", nil, subjectAuditSnapshot(subject))

	c.JSON(http.StatusCreated, gin.H{
		"message": "Subject created successfully",
		"subject": subject,
	})
}

func (h *SubjectHandler) UpdateSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Предмет не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := subjectAuditSnapshot(subject)

	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Название не может быть пустым"})
			return
		}

		var existing models.Subject
		if err := h.db.Where("LOWER(name) = LOWER(?) AND id <> ?", req.Name, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Предмет с таким названием уже существует"})
			return
		} else if err != nil && err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}

		subject.Name = req.Name
	}

	if req.DefaultDurationMin != nil {
		if *req.DefaultDurationMin != 30 && *req.DefaultDurationMin != 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Длительность занятия по умолчанию должна быть 30 или 50 минут"})
			return
		}
		subject.DefaultDurationMin = *req.DefaultDurationMin
	}
	if req.MinimumTeacherBreakMinutes != nil {
		if !validMinimumTeacherBreak(*req.MinimumTeacherBreakMinutes) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Минимальный перерыв преподавателя должен быть 5 или 10 минут"})
			return
		}
		subject.MinimumTeacherBreakMinutes = *req.MinimumTeacherBreakMinutes
	}

	if req.IsActive != nil {
		subject.IsActive = *req.IsActive
	}

	if err := h.db.Save(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить предмет"})
		return
	}
	logging.AdminMutation(c, "schedule.subject.update", before, subjectAuditSnapshot(subject))

	c.JSON(http.StatusOK, gin.H{
		"message": "Subject updated successfully",
		"subject": subject,
	})
}

func (h *SubjectHandler) DeactivateSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Предмет не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := subjectAuditSnapshot(subject)

	subject.IsActive = false

	if err := h.db.Save(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	logging.AdminMutation(c, "schedule.subject.deactivate", before, subjectAuditSnapshot(subject))

	c.JSON(http.StatusOK, gin.H{
		"message": "Subject deactivated successfully",
		"subject": subject,
	})
}

func (h *SubjectHandler) DeleteSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Предмет не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := subjectAuditSnapshot(subject)
	now := time.Now()
	if err := h.db.Model(&subject).Update("archived_at", now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось переместить предмет в архив"})
		return
	}
	logging.AdminMutation(c, "schedule.subject.archive", before, nil)
	c.JSON(http.StatusOK, gin.H{"message": "Предмет перемещён в архив"})
}

func (h *SubjectHandler) RestoreSubject(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	if err := h.db.Model(&models.Subject{}).Where("id = ? AND archived_at IS NOT NULL", id).Update("archived_at", nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось восстановить предмет"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Предмет восстановлен"})
}
