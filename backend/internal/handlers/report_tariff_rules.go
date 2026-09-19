package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportTariffRuleHandler struct {
	db *gorm.DB
}

func NewReportTariffRuleHandler(db *gorm.DB) *ReportTariffRuleHandler {
	return &ReportTariffRuleHandler{db: db}
}

type reportTariffRuleRequest struct {
	SubjectID          *uint  `json:"subject_id"`
	SlotType           string `json:"slot_type" binding:"required"`
	DurationMinutes    int    `json:"duration_minutes" binding:"required"`
	CommercialTariffID uint   `json:"commercial_tariff_id" binding:"required"`
	IsActive           *bool  `json:"is_active"`
}

// PreviewSlotCoverage performs no write. It lets the manual schedule form
// explain a zero-priced report row before it creates or changes a slot.
type reportTariffPreviewRequest struct {
	SlotType  string `json:"slot_type" binding:"required"`
	SubjectID *uint  `json:"subject_id"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}

func (h *ReportTariffRuleHandler) PreviewSlotCoverage(c *gin.Context) {
	var req reportTariffPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SlotType != models.SlotTypeIndividual && req.SlotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Тип занятия должен быть индивидуальным или групповым"})
		return
	}
	if req.SlotType == models.SlotTypeIndividual && (req.SubjectID == nil || *req.SubjectID == 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Для индивидуального занятия выберите предмет"})
		return
	}
	start, startErr := time.Parse("15:04", req.StartTime)
	end, endErr := time.Parse("15:04", req.EndTime)
	if startErr != nil || endErr != nil || !end.After(start) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите корректное время начала и окончания"})
		return
	}
	duration := int(end.Sub(start).Minutes())
	lookup, err := loadActiveReportTariffLookup(h.db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось проверить правило тарификации"})
		return
	}
	subjectID := req.SubjectID
	if req.SlotType == models.SlotTypeGroup {
		subjectID = nil
	}
	c.JSON(http.StatusOK, resolveReportTariff(lookup, req.SlotType, subjectID, duration))
}

func (h *ReportTariffRuleHandler) GetAll(c *gin.Context) {
	var rules []models.ReportTariffRule
	if err := h.db.Preload("Subject").Preload("CommercialTariff").
		Order("slot_type ASC, subject_id ASC NULLS FIRST, duration_minutes ASC, id ASC").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить правила тарификации"})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func (h *ReportTariffRuleHandler) Create(c *gin.Context) {
	var req reportTariffRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := h.validate(req, 0); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	rule := models.ReportTariffRule{
		SubjectID: req.SubjectID, SlotType: req.SlotType, DurationMinutes: req.DurationMinutes,
		CommercialTariffID: req.CommercialTariffID, IsActive: isActive,
	}
	// IsActive has a database default of true. GORM applies that default to a
	// false bool on insert, so persist the requested value explicitly inside
	// the same transaction.
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&rule).Error; err != nil {
			return err
		}
		return tx.Model(&rule).UpdateColumn("is_active", isActive).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить правило тарификации"})
		return
	}
	h.db.Preload("Subject").Preload("CommercialTariff").First(&rule, rule.ID)
	logging.AdminMutation(c, "schedule.report_tariff_rule.create", nil, reportTariffRuleAuditSnapshot(rule))
	c.JSON(http.StatusCreated, rule)
}

func (h *ReportTariffRuleHandler) Update(c *gin.Context) {
	var rule models.ReportTariffRule
	if err := h.db.First(&rule, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Правило тарификации не найдено"})
		return
	}
	before := reportTariffRuleAuditSnapshot(rule)
	var req reportTariffRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := h.validate(req, rule.ID); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}

	isActive := rule.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	rule.SubjectID = req.SubjectID
	rule.SlotType = req.SlotType
	rule.DurationMinutes = req.DurationMinutes
	rule.CommercialTariffID = req.CommercialTariffID
	rule.IsActive = isActive
	if err := h.db.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить правило тарификации"})
		return
	}
	h.db.Preload("Subject").Preload("CommercialTariff").First(&rule, rule.ID)
	logging.AdminMutation(c, "schedule.report_tariff_rule.update", before, reportTariffRuleAuditSnapshot(rule))
	c.JSON(http.StatusOK, rule)
}

// Delete permanently removes a report-only rule. It does not modify schedules.
func (h *ReportTariffRuleHandler) Delete(c *gin.Context) {
	var rule models.ReportTariffRule
	if err := h.db.First(&rule, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Правило тарификации не найдено"})
		return
	}
	before := reportTariffRuleAuditSnapshot(rule)
	if err := h.db.Delete(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить правило тарификации"})
		return
	}
	logging.AdminMutation(c, "schedule.report_tariff_rule.delete", before, nil)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ReportTariffRuleHandler) validate(req reportTariffRuleRequest, excludedID uint) string {
	if req.SlotType != models.SlotTypeIndividual && req.SlotType != models.SlotTypeGroup {
		return "Тип занятия должен быть индивидуальным или групповым"
	}
	if req.DurationMinutes <= 0 {
		return "Длительность должна быть больше нуля"
	}
	if req.SlotType == models.SlotTypeIndividual && req.SubjectID == nil {
		return "Для индивидуального занятия выберите предмет"
	}
	if req.SlotType == models.SlotTypeGroup && req.SubjectID != nil {
		return "Тариф для группового занятия применяется ко всем групповым занятиям и не выбирает предмет"
	}
	if req.SubjectID != nil {
		var subject models.Subject
		if err := h.db.Where("archived_at IS NULL").First(&subject, *req.SubjectID).Error; err != nil {
			return "Выбранный предмет не найден"
		}
		// A paused subject can still be present in historical or manually kept
		// lessons. A reporting rule is independent from schedule generation, so
		// administrators must be able to configure its tariff as well.
	}

	var tariff models.CommercialTariff
	if err := h.db.First(&tariff, req.CommercialTariffID).Error; err != nil {
		return "Выбранный тариф не найден"
	}
	if tariff.PriceRub == nil {
		return "Для правила можно выбрать только тариф с числовой стоимостью"
	}
	if tariff.DurationMinutes == nil || *tariff.DurationMinutes != req.DurationMinutes {
		return "Длительность правила должна совпадать с длительностью выбранного тарифа"
	}

	query := h.db.Model(&models.ReportTariffRule{}).
		Where("slot_type = ? AND duration_minutes = ?", req.SlotType, req.DurationMinutes)
	if req.SubjectID == nil {
		query = query.Where("subject_id IS NULL")
	} else {
		query = query.Where("subject_id = ?", *req.SubjectID)
	}
	if excludedID != 0 {
		query = query.Where("id <> ?", excludedID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return "Не удалось проверить правило тарификации"
	}
	if count > 0 {
		return "Правило для этого типа занятия, предмета и длительности уже существует"
	}
	return ""
}
