package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SiteSettingHandler struct {
	db *gorm.DB
}

func NewSiteSettingHandler(db *gorm.DB) *SiteSettingHandler {
	return &SiteSettingHandler{db: db}
}

// GetAll returns all site settings as a key→value map.
func (h *SiteSettingHandler) GetAll(c *gin.Context) {
	var settings []models.SiteSetting
	h.db.Find(&settings)

	result := make(map[string]string, len(settings))
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	c.JSON(http.StatusOK, result)
}

// GetByKey returns a single setting value.
func (h *SiteSettingHandler) GetByKey(c *gin.Context) {
	key := c.Param("key")
	var setting models.SiteSetting
	if err := h.db.Where("key = ?", key).First(&setting).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "setting not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"key": setting.Key, "value": setting.Value})
}

// Upsert creates or updates a setting by key.
func (h *SiteSettingHandler) Upsert(c *gin.Context) {
	var req struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var setting models.SiteSetting
	result := h.db.Where("key = ?", req.Key).First(&setting)
	if result.Error != nil {
		setting = models.SiteSetting{Key: req.Key, Value: req.Value}
		h.db.Create(&setting)
	} else {
		setting.Value = req.Value
		h.db.Save(&setting)
	}

	c.JSON(http.StatusOK, gin.H{"key": setting.Key, "value": setting.Value})
}

// UpsertBulk updates multiple settings at once.
// Body: { "key1": "value1", "key2": "value2" }
func (h *SiteSettingHandler) UpsertBulk(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for key, value := range req {
		var setting models.SiteSetting
		result := h.db.Where("key = ?", key).First(&setting)
		if result.Error != nil {
			h.db.Create(&models.SiteSetting{Key: key, Value: value})
		} else {
			setting.Value = value
			h.db.Save(&setting)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
