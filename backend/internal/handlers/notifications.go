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

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

// CreateNotification is a helper used by other handlers to create notifications.
// For admin-targeted notifications pass role="admin" and userID=0; the function
// will fan out to all users with role="admin".
func CreateNotification(db *gorm.DB, userID uint, role, title, body, link string) {
	if role == "admin" {
		var admins []models.User
		db.Where("role = 'admin'").Find(&admins)
		for _, a := range admins {
			db.Create(&models.Notification{
				UserID: a.ID,
				Title:  title,
				Body:   body,
				Link:   link,
			})
		}
		return
	}
	db.Create(&models.Notification{
		UserID: userID,
		Title:  title,
		Body:   body,
		Link:   link,
	})
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
