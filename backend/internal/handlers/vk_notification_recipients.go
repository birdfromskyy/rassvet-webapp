package handlers

import (
	"errors"
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
	db              *gorm.DB
	vkService       *services.VKNotificationService
	scheduleService *services.VKTeacherScheduleService
}

type vkNotificationRecipientRequest struct {
	ProfileURL                   string `json:"profile_url" binding:"required"`
	IsEnabled                    *bool  `json:"is_enabled"`
	ReceiveAdminNotifications    *bool  `json:"receive_admin_notifications"`
	ReceiveScheduleNotifications *bool  `json:"receive_schedule_notifications"`
	TeacherID                    *uint  `json:"teacher_id"`
}

func NewVKNotificationRecipientHandler(db *gorm.DB, vkService *services.VKNotificationService, scheduleService ...*services.VKTeacherScheduleService) *VKNotificationRecipientHandler {
	handler := &VKNotificationRecipientHandler{db: db, vkService: vkService}
	if len(scheduleService) > 0 {
		handler.scheduleService = scheduleService[0]
	}
	return handler
}

func (h *VKNotificationRecipientHandler) GetAll(c *gin.Context) {
	var recipients []models.VKNotificationRecipient
	if err := h.db.Preload("Teacher").Order("id ASC").Find(&recipients).Error; err != nil {
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
	receiveAdminNotifications := true
	if request.ReceiveAdminNotifications != nil {
		receiveAdminNotifications = *request.ReceiveAdminNotifications
	}
	receiveScheduleNotifications := false
	if request.ReceiveScheduleNotifications != nil {
		receiveScheduleNotifications = *request.ReceiveScheduleNotifications
	}
	teacherID := normalizedTeacherID(request.TeacherID)
	if err := h.validateTeacherBinding(teacherID, receiveScheduleNotifications); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	recipient := models.VKNotificationRecipient{
		VKUserID:                     vkUserID,
		ProfileURL:                   request.ProfileURL,
		IsEnabled:                    isEnabled,
		ReceiveAdminNotifications:    receiveAdminNotifications,
		ReceiveScheduleNotifications: receiveScheduleNotifications,
		TeacherID:                    teacherID,
	}
	if !isEnabled {
		now := time.Now()
		recipient.DisabledAt = &now
	}
	if err := h.db.Select("*").Create(&recipient).Error; err != nil {
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
	if request.ReceiveAdminNotifications != nil {
		recipient.ReceiveAdminNotifications = *request.ReceiveAdminNotifications
	}
	if request.ReceiveScheduleNotifications != nil {
		recipient.ReceiveScheduleNotifications = *request.ReceiveScheduleNotifications
	}
	if request.TeacherID != nil {
		recipient.TeacherID = normalizedTeacherID(request.TeacherID)
	}
	if err := h.validateTeacherBinding(recipient.TeacherID, recipient.ReceiveScheduleNotifications); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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
	h.db.Preload("Teacher").First(&recipient, recipient.ID)
	c.JSON(http.StatusOK, recipient)
}

func normalizedTeacherID(teacherID *uint) *uint {
	if teacherID == nil || *teacherID == 0 {
		return nil
	}
	return teacherID
}

func (h *VKNotificationRecipientHandler) Delete(c *gin.Context) {
	var recipient models.VKNotificationRecipient
	if err := h.db.First(&recipient, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Получатель не найден"})
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("recipient_id = ?", recipient.ID).Delete(&models.VKScheduleChangeEvent{}).Error; err != nil {
			return err
		}
		if err := tx.Where("recipient_id = ?", recipient.ID).Delete(&models.VKScheduleDayDelivery{}).Error; err != nil {
			return err
		}
		return tx.Delete(&recipient).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить получателя"})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.delete", recipient, nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *VKNotificationRecipientHandler) validateTeacherBinding(teacherID *uint, scheduleNotifications bool) error {
	if teacherID == nil {
		if scheduleNotifications {
			return errors.New("выберите преподавателя для уведомлений о расписании")
		}
		return nil
	}
	if *teacherID == 0 {
		return errors.New("укажите корректного преподавателя")
	}
	var count int64
	if err := h.db.Model(&models.Teacher{}).Where("id = ? AND archived_at IS NULL", *teacherID).Count(&count).Error; err != nil {
		return errors.New("не удалось проверить преподавателя")
	}
	if count == 0 {
		return errors.New("преподаватель не найден")
	}
	return nil
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

func (h *VKNotificationRecipientHandler) SendScheduleTest(c *gin.Context) {
	if h.scheduleService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Доставка расписания временно недоступна"})
		return
	}
	var recipient models.VKNotificationRecipient
	if err := h.db.First(&recipient, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Получатель не найден"})
		return
	}
	if err := h.scheduleService.SendTomorrowTest(c.Request.Context(), recipient); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	logging.AdminMutation(c, "vk_notification_recipient.schedule_test", nil, gin.H{
		"recipient_id": recipient.ID,
		"teacher_id":   recipient.TeacherID,
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
