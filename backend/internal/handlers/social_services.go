package handlers

import (
	"backend/internal/database"
	"backend/internal/logging"
	"backend/internal/models"
	"backend/internal/utils"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SocialServiceHandler struct{ db *gorm.DB }

func NewSocialServiceHandler(db *gorm.DB) *SocialServiceHandler { return &SocialServiceHandler{db: db} }

type socialServiceRequest struct {
	Code                    string `json:"code" binding:"required"`
	Category                string `json:"category" binding:"required"`
	Name                    string `json:"name" binding:"required"`
	StandardDurationMinutes int    `json:"standard_duration_minutes"`
	Periodicity             string `json:"periodicity" binding:"required"`
	TariffKopecks           int64  `json:"tariff_kopecks"`
	SortOrder               int    `json:"sort_order"`
	IsActive                *bool  `json:"is_active"`
}

type studentSocialServiceRequest struct {
	Periodicity             string `json:"periodicity" binding:"required"`
	MaximumMonthlyCount     int    `json:"maximum_monthly_count"`
	ActualMonthlyCount      int    `json:"actual_monthly_count"`
	StandardDurationMinutes int    `json:"standard_duration_minutes"`
	TariffKopecks           int64  `json:"tariff_kopecks"`
}

func validateSocialServiceInput(code, category, name, periodicity string, duration, maximum, actual int, tariff int64, individual bool) string {
	if strings.TrimSpace(code) == "" || strings.TrimSpace(category) == "" || strings.TrimSpace(name) == "" || strings.TrimSpace(periodicity) == "" {
		return "Заполните обязательные поля"
	}
	if duration <= 0 {
		return "Стандартное время должно быть больше нуля"
	}
	if tariff < 0 {
		return "Тариф не может быть отрицательным"
	}
	if individual {
		if maximum < 0 || actual < 0 {
			return "Количество услуг не может быть отрицательным"
		}
		if actual > maximum {
			return "Фактическое количество не может превышать максимум за месяц"
		}
	}
	return ""
}

func socialServiceFromRequest(req socialServiceRequest, active bool) models.SocialService {
	return models.SocialService{Code: strings.TrimSpace(req.Code), Category: strings.TrimSpace(req.Category), Name: strings.TrimSpace(req.Name), StandardDurationMinutes: req.StandardDurationMinutes, Periodicity: utils.NormalizeSocialServicePeriodicity(req.Periodicity), TariffKopecks: req.TariffKopecks, SortOrder: req.SortOrder, IsActive: active}
}

func (h *SocialServiceHandler) GetAll(c *gin.Context) {
	query := h.db.Model(&models.SocialService{})
	if c.Query("include_inactive") != "true" {
		query = query.Where("is_active = ?", true)
	}
	var rows []models.SocialService
	if err := query.Order("category ASC, sort_order ASC, id ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить услуги"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"services": rows})
}

// ImportInitialDirectory adds the supplied reporting directory on explicit
// administrator action. It never updates or deletes an existing row.
func (h *SocialServiceHandler) ImportInitialDirectory(c *gin.Context) {
	created, err := database.ImportInitialSocialServices(h.db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось добавить исходный список услуг"})
		return
	}
	logging.AdminMutation(c, "social_service.initial_directory_import", nil, gin.H{"created": created})
	c.JSON(http.StatusOK, gin.H{"created": created})
}

func (h *SocialServiceHandler) Create(c *gin.Context) {
	var req socialServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := validateSocialServiceInput(req.Code, req.Category, req.Name, req.Periodicity, req.StandardDurationMinutes, 0, 0, req.TariffKopecks, false); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	row := socialServiceFromRequest(req, active)
	if err := h.db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать услугу"})
		return
	}
	logging.AdminMutation(c, "social_service.create", nil, row)
	c.JSON(http.StatusCreated, gin.H{"service": row})
}

func (h *SocialServiceHandler) Update(c *gin.Context) {
	var row models.SocialService
	if err := h.db.First(&row, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Услуга не найдена"})
		return
	}
	before := row
	var req socialServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := validateSocialServiceInput(req.Code, req.Category, req.Name, req.Periodicity, req.StandardDurationMinutes, 0, 0, req.TariffKopecks, false); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	active := row.IsActive
	if req.IsActive != nil {
		active = *req.IsActive
	}
	updated := socialServiceFromRequest(req, active)
	updated.ID = row.ID
	updated.CreatedAt = row.CreatedAt
	if err := h.db.Save(&updated).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить услугу"})
		return
	}
	logging.AdminMutation(c, "social_service.update", before, updated)
	c.JSON(http.StatusOK, gin.H{"service": updated})
}

func (h *SocialServiceHandler) Delete(c *gin.Context) {
	id, ok := parseSocialServiceID(c, "id")
	if !ok {
		return
	}
	var row models.SocialService
	var before models.SocialService
	archived := false
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, id).Error; err != nil {
			return err
		}
		before = row
		var legacy, monthly, history int64
		if err := tx.Model(&models.StudentSocialService{}).Where("social_service_id = ?", id).Count(&legacy).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StudentServiceMonthItem{}).Where("social_service_id = ?", id).Count(&monthly).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StudentServiceMonthRevision{}).Where("EXISTS (SELECT 1 FROM jsonb_array_elements(data->'items') item WHERE (item->>'social_service_id')::bigint = ?)", id).Count(&history).Error; err != nil {
			return err
		}
		if legacy+monthly+history > 0 {
			archived = true
			return tx.Model(&row).Update("is_active", false).Error
		}
		return tx.Delete(&row).Error
	})
	if err != nil {
		reportingError(c, err)
		return
	}
	if archived {
		logging.AdminMutation(c, "social_service.archive", before, row)
	} else {
		logging.AdminMutation(c, "social_service.delete", row, nil)
	}
	c.Status(http.StatusNoContent)
}

func parseSocialServiceID(c *gin.Context, param string) (uint, bool) {
	id, err := strconv.ParseUint(c.Param(param), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return 0, false
	}
	return uint(id), true
}

func (h *SocialServiceHandler) GetForStudent(c *gin.Context) {
	studentID, ok := parseSocialServiceID(c, "id")
	if !ok {
		return
	}
	if !h.requireLegacyServices(c, studentID) {
		return
	}
	var rows []models.StudentSocialService
	if err := h.db.Preload("SocialService").Where("student_id = ?", studentID).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить услуги ребёнка"})
		return
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].SocialService.Category == rows[j].SocialService.Category {
			return rows[i].SocialService.SortOrder < rows[j].SocialService.SortOrder
		}
		return rows[i].SocialService.Category < rows[j].SocialService.Category
	})
	c.JSON(http.StatusOK, gin.H{"services": rows})
}

func (h *SocialServiceHandler) SelectForStudent(c *gin.Context) {
	studentID, ok := parseSocialServiceID(c, "id")
	if !ok {
		return
	}
	if !h.requireLegacyServices(c, studentID) {
		return
	}
	var body struct {
		SocialServiceIDs []uint `json:"social_service_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	seen := map[uint]bool{}
	ids := make([]uint, 0, len(body.SocialServiceIDs))
	for _, id := range body.SocialServiceIDs {
		if id != 0 && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ребёнок не найден"})
		return
	}
	var directory []models.SocialService
	if len(ids) > 0 {
		if err := h.db.Where("id IN ? AND is_active = ?", ids, true).Find(&directory).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить услуги"})
			return
		}
		if len(directory) != len(ids) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Можно выбрать только активные услуги"})
			return
		}
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if len(ids) == 0 {
			return tx.Where("student_id = ?", studentID).Delete(&models.StudentSocialService{}).Error
		}
		if err := tx.Where("student_id = ? AND social_service_id NOT IN ?", studentID, ids).Delete(&models.StudentSocialService{}).Error; err != nil {
			return err
		}
		for _, service := range directory {
			periodicity := utils.NormalizeSocialServicePeriodicity(service.Periodicity)
			row := models.StudentSocialService{StudentID: studentID, SocialServiceID: service.ID, Periodicity: periodicity, MaximumMonthlyCount: utils.SocialServiceMaximumMonthlyCount(periodicity), StandardDurationMinutes: service.StandardDurationMinutes, TariffKopecks: service.TariffKopecks}
			if err := tx.Where("student_id = ? AND social_service_id = ?", studentID, service.ID).FirstOrCreate(&row).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить услуги ребёнка"})
		return
	}
	logging.AdminMutation(c, "student_social_service.select", nil, gin.H{"student_id": studentID, "social_service_ids": ids})
	h.GetForStudent(c)
}

func (h *SocialServiceHandler) UpdateForStudent(c *gin.Context) {
	studentID, ok := parseSocialServiceID(c, "id")
	if !ok {
		return
	}
	if !h.requireLegacyServices(c, studentID) {
		return
	}
	rowID, ok := parseSocialServiceID(c, "serviceId")
	if !ok {
		return
	}
	var row models.StudentSocialService
	if err := h.db.Where("id = ? AND student_id = ?", rowID, studentID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Услуга ребёнка не найдена"})
		return
	}
	before := row
	var req studentSocialServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	periodicity := utils.NormalizeSocialServicePeriodicity(req.Periodicity)
	maximumMonthlyCount := utils.SocialServiceMaximumMonthlyCount(periodicity)
	if message := validateSocialServiceInput("ok", "ok", "ok", periodicity, req.StandardDurationMinutes, maximumMonthlyCount, req.ActualMonthlyCount, req.TariffKopecks, true); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	row.Periodicity = periodicity
	row.MaximumMonthlyCount = maximumMonthlyCount
	row.ActualMonthlyCount = req.ActualMonthlyCount
	row.StandardDurationMinutes = req.StandardDurationMinutes
	row.TariffKopecks = req.TariffKopecks
	if err := h.db.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить услугу ребёнка"})
		return
	}
	logging.AdminMutation(c, "student_social_service.update", before, row)
	c.JSON(http.StatusOK, gin.H{"service": row})
}

func (h *SocialServiceHandler) DeleteForStudent(c *gin.Context) {
	studentID, ok := parseSocialServiceID(c, "id")
	if !ok {
		return
	}
	if !h.requireLegacyServices(c, studentID) {
		return
	}
	rowID, ok := parseSocialServiceID(c, "serviceId")
	if !ok {
		return
	}
	var row models.StudentSocialService
	if err := h.db.Where("id = ? AND student_id = ?", rowID, studentID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Услуга ребёнка не найдена"})
		return
	}
	if err := h.db.Delete(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить услугу ребёнка"})
		return
	}
	logging.AdminMutation(c, "student_social_service.delete", row, nil)
	c.Status(http.StatusNoContent)
}

// Cutover is explicit. Never let the old frontend export timeless quantities
// as if they belonged to an arbitrary month after migration.
func (h *SocialServiceHandler) requireLegacyServices(c *gin.Context, studentID uint) bool {
	var count int64
	if err := h.db.Model(&models.StudentServiceMonth{}).Where("student_id = ?", studentID).Count(&count).Error; err != nil {
		reportingError(c, err)
		return false
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Ребёнок переведён на месячные услуги. Используйте месячный API", "code": "monthly_reporting_required"})
		return false
	}
	return true
}
