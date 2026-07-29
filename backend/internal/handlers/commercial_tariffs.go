package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommercialTariffHandler struct {
	db *gorm.DB
}

func NewCommercialTariffHandler(db *gorm.DB) *CommercialTariffHandler {
	return &CommercialTariffHandler{db: db}
}

type CommercialTariffRequest struct {
	ServiceName     string     `json:"service_name" binding:"required"`
	VolumeLabel     string     `json:"volume_label" binding:"required"`
	DurationMinutes *int       `json:"duration_minutes"`
	PriceRub        *int       `json:"price_rub"`
	PriceNote       string     `json:"price_note"`
	EffectiveFrom   time.Time  `json:"effective_from" binding:"required"`
	EffectiveTo     *time.Time `json:"effective_to"`
	SortOrder       int        `json:"sort_order"`
	IsActive        *bool      `json:"is_active"`
}

var commercialTariffMinutesPattern = regexp.MustCompile(`^\s*(\d+)\s*мин\.?\s*$`)

// durationFromVolumeLabel keeps a machine-readable duration for future reports
// without making the administrator enter the same value twice.
func durationFromVolumeLabel(volumeLabel string) *int {
	matches := commercialTariffMinutesPattern.FindStringSubmatch(strings.ToLower(volumeLabel))
	if len(matches) != 2 {
		return nil
	}
	minutes, err := strconv.Atoi(matches[1])
	if err != nil || minutes <= 0 {
		return nil
	}
	return &minutes
}

func validateCommercialTariff(req CommercialTariffRequest) string {
	if req.PriceRub == nil && req.PriceNote == "" {
		return "Укажите тариф или пояснение к стоимости"
	}
	if req.PriceRub != nil && *req.PriceRub < 0 {
		return "Тариф не может быть отрицательным"
	}
	if req.DurationMinutes != nil && *req.DurationMinutes <= 0 {
		return "Длительность должна быть больше нуля"
	}
	if req.EffectiveTo != nil && req.EffectiveTo.Before(req.EffectiveFrom) {
		return "Дата окончания не может быть раньше даты начала"
	}
	return ""
}

func commercialTariffFromRequest(req CommercialTariffRequest, isActive bool) models.CommercialTariff {
	duration := req.DurationMinutes
	if duration == nil {
		duration = durationFromVolumeLabel(req.VolumeLabel)
	}
	return models.CommercialTariff{
		ServiceName:     req.ServiceName,
		VolumeLabel:     req.VolumeLabel,
		DurationMinutes: duration,
		PriceRub:        req.PriceRub,
		PriceNote:       req.PriceNote,
		EffectiveFrom:   req.EffectiveFrom,
		EffectiveTo:     req.EffectiveTo,
		SortOrder:       req.SortOrder,
		IsActive:        isActive,
	}
}

// GetCommercialTariffs returns only tariffs published for the public page.
func (h *CommercialTariffHandler) GetCommercialTariffs(c *gin.Context) {
	var tariffs []models.CommercialTariff
	if err := h.db.Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&tariffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить тарифы"})
		return
	}
	c.JSON(http.StatusOK, tariffs)
}

func (h *CommercialTariffHandler) GetAllCommercialTariffs(c *gin.Context) {
	var tariffs []models.CommercialTariff
	if err := h.db.Order("sort_order ASC, id ASC").Find(&tariffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить тарифы"})
		return
	}
	c.JSON(http.StatusOK, tariffs)
}

func (h *CommercialTariffHandler) CreateCommercialTariff(c *gin.Context) {
	var req CommercialTariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := validateCommercialTariff(req); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	tariff := commercialTariffFromRequest(req, isActive)
	// CommercialTariff has a database default of true for legacy rows. GORM
	// omits a false field that has a default during INSERT, even with Select.
	// Set it explicitly in the same transaction so the administrator's initial
	// "Скрыть" choice is never silently changed to publication.
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&tariff).Error; err != nil {
			return err
		}
		return tx.Model(&tariff).UpdateColumn("is_active", isActive).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	logging.AdminMutation(c, "schedule.commercial_tariff.create", nil, commercialTariffAuditSnapshot(tariff))
	c.JSON(http.StatusCreated, tariff)
}

func (h *CommercialTariffHandler) UpdateCommercialTariff(c *gin.Context) {
	var tariff models.CommercialTariff
	if err := h.db.First(&tariff, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Тариф не найден"})
		return
	}
	before := commercialTariffAuditSnapshot(tariff)

	var req CommercialTariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if message := validateCommercialTariff(req); message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}

	isActive := tariff.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	updated := commercialTariffFromRequest(req, isActive)
	updated.ID = tariff.ID
	updated.CreatedAt = tariff.CreatedAt
	if err := h.db.Save(&updated).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	logging.AdminMutation(c, "schedule.commercial_tariff.update", before, commercialTariffAuditSnapshot(updated))
	c.JSON(http.StatusOK, updated)
}

func (h *CommercialTariffHandler) DeleteCommercialTariff(c *gin.Context) {
	var tariff models.CommercialTariff
	if err := h.db.First(&tariff, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Тариф не найден"})
		return
	}
	before := commercialTariffAuditSnapshot(tariff)
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		// A tariff page deletion is intentionally hard. Report-only bindings are
		// removed with it so no orphaned rule can affect a report.
		if err := tx.Where("commercial_tariff_id = ?", tariff.ID).Delete(&models.ReportTariffRule{}).Error; err != nil {
			return err
		}
		return tx.Delete(&tariff).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	logging.AdminMutation(c, "schedule.commercial_tariff.delete", before, nil)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
