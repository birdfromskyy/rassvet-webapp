package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	db *gorm.DB
}

type adminNotificationSender interface {
	QueueAdminNotification(notificationID uint)
}

var externalAdminNotificationSender adminNotificationSender

// ConfigureAdminNotificationSender is called once during application startup.
// Tests and deployments without a VK token keep the sender nil/no-op.
func ConfigureAdminNotificationSender(sender adminNotificationSender) {
	externalAdminNotificationSender = sender
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

// CreateNotification is a helper used by other handlers to create notifications.
// For admin-targeted notifications pass role="admin" and userID=0; the function
// will fan out to all users with role="admin". It returns an error so callers
// that need delivery guarantees can keep their state changes transactional.
func CreateNotification(db *gorm.DB, userID uint, role, title, body, link string) error {
	if models.IsAdminRole(role) {
		var admins []models.User
		if err := db.Where("role IN ('admin','superadmin')").Find(&admins).Error; err != nil {
			return err
		}
		var deliveryNotificationID uint
		for _, a := range admins {
			notification := models.Notification{
				UserID: a.ID,
				Title:  title,
				Body:   body,
				Link:   link,
			}
			if err := db.Create(&notification).Error; err != nil {
				return err
			}
			if deliveryNotificationID == 0 {
				deliveryNotificationID = notification.ID
			}
		}
		if externalAdminNotificationSender != nil && deliveryNotificationID != 0 {
			externalAdminNotificationSender.QueueAdminNotification(deliveryNotificationID)
		}
		return nil
	}
	return db.Create(&models.Notification{
		UserID: userID,
		Title:  title,
		Body:   body,
		Link:   link,
	}).Error
}

// GET /api/notifications
func (h *NotificationHandler) GetMyNotifications(c *gin.Context) {
	userID := c.GetUint("userID")
	var notifications []models.Notification
	h.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(50).
		Find(&notifications)
	c.JSON(http.StatusOK, notifications)
}

// GET /api/notifications/unread-count
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := c.GetUint("userID")
	var count int64
	h.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Count(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// PUT /api/notifications/:id/read
func (h *NotificationHandler) MarkOneRead(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	h.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PUT /api/notifications/read-all
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := c.GetUint("userID")
	h.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Update("is_read", true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/notifications/:id
// Hard delete. Notifications fanned out to admins/superadmins (same title/body/link,
// one row per recipient) are removed for ALL recipients, not just the caller —
// otherwise the same notification would keep reappearing for other admins.
func (h *NotificationHandler) DeleteOne(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var n models.Notification
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&n).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Уведомление не найдено"})
		return
	}

	h.db.Unscoped().
		Where("title = ? AND body = ? AND link = ?", n.Title, n.Body, n.Link).
		Delete(&models.Notification{})

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/notifications
// Hard delete of all notifications visible to the caller (same cross-recipient rule as DeleteOne).
func (h *NotificationHandler) DeleteAll(c *gin.Context) {
	userID := c.GetUint("userID")

	var mine []models.Notification
	h.db.Where("user_id = ?", userID).Find(&mine)

	for _, n := range mine {
		h.db.Unscoped().
			Where("title = ? AND body = ? AND link = ?", n.Title, n.Body, n.Link).
			Delete(&models.Notification{})
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
