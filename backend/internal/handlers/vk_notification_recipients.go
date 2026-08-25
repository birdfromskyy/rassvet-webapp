package handlers

import (
	"net/http"
	"strings"
	"time"

	"backend/internal/logging"
	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VKNotificationRecipientHandler struct {
	db        *gorm.DB
	vkService *services.VKNotificationService
}

type vkNotificationRecipientRequest struct {
	ProfileURL string `json:"profile_url" binding:"required"`
	IsEnabled  *bool  `json:"is_enabled"`
}

func NewVKNotificationRecipientHandler(db *gorm.DB, vkService *services.VKNotificationService) *VKNotificationRecipientHandler {
	return &VKNotificationRecipientHandler{db: db, vkService: vkService}
}

func (h *VKNotificationRecipientHandler) GetAll(c *gin.Context) {
	var recipients []models.VKNotificationRecipient
	if err := h.db.Order("id ASC").Find(&recipients).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить получателей VK"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"configured": h.vkService.Configured(),
		"recipients": recipients,
	})
}

func (h *VKNotificationRecipientHandler) Create(c *gin.Context) {
	var request vkNotificationRecipientRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите ссылку на страницу VK"})
		return
	}
	request.ProfileURL = normalizeVKProfileURL(request.ProfileURL)
	vkUserID, err := h.vkService.ResolveUserID(c.Request.Context(), request.ProfileURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var existing int64
	if err := h.db.Model(&models.VKNotificationRecipient{}).Where("vk_user_id = ?", vkUserID).Count(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось проверить получателя"})
		return
	}
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Эта страница VK уже добавлена"})
		return
	}

	isEnabled := true
	if request.IsEnabled != nil {
		isEnabled = *request.IsEnabled
	}
	recipient := models.VKNotificationRecipient{
		VKUserID:   vkUserID,
		ProfileURL: request.ProfileURL,
		IsEnabled:  isEnabled,
	}
	if !isEnabled {
		now := time.Now()
		recipient.DisabledAt = &now
	}
	if err := h.db.Create(&recipient).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Эта страница VK уже добавлена"})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.create", nil, recipient)
	c.JSON(http.StatusCreated, recipient)
}

func (h *VKNotificationRecipientHandler) Update(c *gin.Context) {
	var recipient models.VKNotificationRecipient
	if err := h.db.First(&recipient, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Получатель не найден"})
		return
	}
	before := recipient
	var request vkNotificationRecipientRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите ссылку на страницу VK"})
		return
	}
	request.ProfileURL = normalizeVKProfileURL(request.ProfileURL)
	vkUserID := recipient.VKUserID
	if request.ProfileURL != recipient.ProfileURL {
		var err error
		vkUserID, err = h.vkService.ResolveUserID(c.Request.Context(), request.ProfileURL)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	var duplicate int64
	if err := h.db.Model(&models.VKNotificationRecipient{}).
		Where("vk_user_id = ? AND id <> ?", vkUserID, recipient.ID).
		Count(&duplicate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось проверить получателя"})
		return
	}
	if duplicate > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Эта страница VK уже добавлена"})
		return
	}

	recipient.VKUserID = vkUserID
	recipient.ProfileURL = request.ProfileURL
	if request.IsEnabled != nil {
		recipient.IsEnabled = *request.IsEnabled
	}
	if recipient.IsEnabled {
		recipient.DisabledAt = nil
	} else if recipient.DisabledAt == nil {
		now := time.Now()
		recipient.DisabledAt = &now
	}
	if err := h.db.Save(&recipient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить получателя"})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.update", before, recipient)
	c.JSON(http.StatusOK, recipient)
}

func (h *VKNotificationRecipientHandler) Delete(c *gin.Context) {
	var recipient models.VKNotificationRecipient
	if err := h.db.First(&recipient, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Получатель не найден"})
		return
	}
	if err := h.db.Delete(&recipient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить получателя"})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.delete", recipient, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *VKNotificationRecipientHandler) SendTest(c *gin.Context) {
	var recipient models.VKNotificationRecipient
	if err := h.db.First(&recipient, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Получатель не найден"})
		return
	}
	if err := h.vkService.SendTest(c.Request.Context(), recipient); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.test", nil, gin.H{
		"recipient_id": recipient.ID,
		"vk_user_id":   recipient.VKUserID,
	})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func normalizeVKProfileURL(value string) string {
	value = strings.TrimSpace(value)
	if value != "" && !strings.Contains(value, "://") {
		return "https://" + value
	}
	return value
}
