package handlers

import (
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"backend/internal/models"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const supportUploadsDir = "./private_uploads/support"

var allowedSupportExts = map[string]bool{
	".pdf":  true,
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".doc":  true,
	".docx": true,
}

var allowedSupportMIMEs = map[string]bool{
	"application/pdf":                                                        true,
	"image/jpeg":                                                             true,
	"image/png":                                                              true,
	"application/msword":                                                     true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
}

const supportMaxFileSizeBytes = 5 * 1024 * 1024 // 5 MB per file

var validSupportCategories = map[models.SupportTicketCategory]bool{
	models.SupportCategoryAccount:   true,
	models.SupportCategoryDocuments: true,
	models.SupportCategorySchedule:  true,
	models.SupportCategorySiteError: true,
	models.SupportCategoryOther:     true,
}

type SupportHandler struct {
	db *gorm.DB
}

func NewSupportHandler(db *gorm.DB) *SupportHandler {
	return &SupportHandler{db: db}
}

// ─── User endpoints ───────────────────────────────────────────────────────────

// POST /api/support/tickets
func (h *SupportHandler) CreateTicket(c *gin.Context) {
	userID := c.GetUint("userID")

	subject := strings.TrimSpace(c.PostForm("subject"))
	category := models.SupportTicketCategory(strings.TrimSpace(c.PostForm("category")))
	body := strings.TrimSpace(c.PostForm("body"))

	if len(subject) < 5 || len(subject) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заголовок должен содержать от 5 до 200 символов"})
		return
	}
	if !validSupportCategories[category] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Недопустимая категория"})
		return
	}
	if len(body) < 10 || len(body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Текст должен содержать от 10 до 5000 символов"})
		return
	}

	savedFiles, err := h.saveAttachments(c, "files", 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket := models.SupportTicket{
		UserID:   userID,
		Subject:  subject,
		Category: category,
		Status:   models.SupportStatusOpen,
	}
	if err := h.db.Create(&ticket).Error; err != nil {
		h.cleanupFiles(savedFiles)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания обращения"})
		return
	}

	msg := models.SupportMessage{
		TicketID:     ticket.ID,
		SenderID:     userID,
		Body:         body,
		IsAdminReply: false,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		h.cleanupFiles(savedFiles)
		h.db.Delete(&ticket)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения сообщения"})
		return
	}

	h.createAttachmentRecords(msg.ID, savedFiles, c)

	// Notify all admins
	CreateNotification(h.db, 0, "admin",
		"Новое обращение в техподдержку",
		fmt.Sprintf("«%s» — %s", subject, categoryLabel(category)),
		fmt.Sprintf("/admin/support/%d", ticket.ID),
	)

	h.db.Preload("Messages.Attachments").Preload("Messages.Sender").Preload("User").First(&ticket, ticket.ID)
	c.JSON(http.StatusCreated, ticket)
}

// GET /api/support/tickets
func (h *SupportHandler) ListMyTickets(c *gin.Context) {
	userID := c.GetUint("userID")
	var tickets []models.SupportTicket
	h.db.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Find(&tickets)
	c.JSON(http.StatusOK, tickets)
}

// GET /api/support/tickets/:id
func (h *SupportHandler) GetMyTicket(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Messages.Attachments").
		Preload("Messages.Sender").
		First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

// POST /api/support/tickets/:id/messages
func (h *SupportHandler) ReplyToTicket(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}
	if ticket.Status == models.SupportStatusClosed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Обращение закрыто. Создайте новое обращение."})
		return
	}

	body := strings.TrimSpace(c.PostForm("body"))
	if len(body) < 1 || len(body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Текст должен содержать от 1 до 5000 символов"})
		return
	}

	savedFiles, err := h.saveAttachments(c, "files", 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := models.SupportMessage{
		TicketID:     ticket.ID,
		SenderID:     userID,
		Body:         body,
		IsAdminReply: false,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		h.cleanupFiles(savedFiles)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения сообщения"})
		return
	}
	h.createAttachmentRecords(msg.ID, savedFiles, c)
	h.db.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

	// Notify all admins
	CreateNotification(h.db, 0, "admin",
		"Новый ответ в обращении",
		fmt.Sprintf("«%s»", ticket.Subject),
		fmt.Sprintf("/admin/support/%d", ticket.ID),
	)

	c.JSON(http.StatusCreated, msg)
}

// PUT /api/support/tickets/:id/close
func (h *SupportHandler) CloseMyTicket(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}
	if ticket.Status == models.SupportStatusClosed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Обращение уже закрыто"})
		return
	}

	h.db.Model(&ticket).Update("status", models.SupportStatusClosed)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /api/support/files/:filename
func (h *SupportHandler) ServeFile(c *gin.Context) {
	filename := c.Param("filename")
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное имя файла"})
		return
	}

	userID := c.GetUint("userID")
	role := c.GetString("role")

	if !models.IsAdminRole(role) {
		// Check that the file belongs to one of this user's messages
		var count int64
		h.db.Model(&models.SupportAttachment{}).
			Joins("JOIN support_messages ON support_messages.id = support_attachments.message_id").
			Joins("JOIN support_tickets ON support_tickets.id = support_messages.ticket_id").
			Where("support_attachments.filename = ? AND support_tickets.user_id = ?", filename, userID).
			Count(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
			return
		}
	}

	filePath := filepath.Join(supportUploadsDir, filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}
	c.Header("Content-Type", ct)
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	c.File(filePath)
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// GET /api/admin/support/tickets
func (h *SupportHandler) AdminListTickets(c *gin.Context) {
	status := c.Query("status")
	category := c.Query("category")

	query := h.db.Model(&models.SupportTicket{}).
		Preload("User").
		Order("updated_at DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}

	var tickets []models.SupportTicket
	query.Find(&tickets)
	c.JSON(http.StatusOK, tickets)
}

// GET /api/admin/support/tickets/:id
func (h *SupportHandler) AdminGetTicket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.
		Preload("User").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Messages.Attachments").
		Preload("Messages.Sender").
		First(&ticket, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

// POST /api/admin/support/tickets/:id/messages
func (h *SupportHandler) AdminReplyToTicket(c *gin.Context) {
	adminID := c.GetUint("userID")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.First(&ticket, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}

	body := strings.TrimSpace(c.PostForm("body"))
	if len(body) < 1 || len(body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Текст должен содержать от 1 до 5000 символов"})
		return
	}

	savedFiles, err := h.saveAttachments(c, "files", 0) // 0 = unlimited
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := models.SupportMessage{
		TicketID:     ticket.ID,
		SenderID:     adminID,
		Body:         body,
		IsAdminReply: true,
	}
	if err := h.db.Create(&msg).Error; err != nil {
		h.cleanupFiles(savedFiles)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения сообщения"})
		return
	}
	h.createAttachmentRecords(msg.ID, savedFiles, c)

	// Auto-transition open → in_progress on first admin reply
	if ticket.Status == models.SupportStatusOpen {
		h.db.Model(&ticket).Update("status", models.SupportStatusInProgress)
	}

	h.db.Preload("Attachments").Preload("Sender").First(&msg, msg.ID)

	// Notify the user
	CreateNotification(h.db, ticket.UserID, "",
		"Новый ответ от Техподдержки",
		fmt.Sprintf("«%s»", ticket.Subject),
		fmt.Sprintf("/support/%d", ticket.ID),
	)

	c.JSON(http.StatusCreated, msg)
}

// PUT /api/admin/support/tickets/:id/status
func (h *SupportHandler) AdminUpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req struct {
		Status models.SupportTicketStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allowed := map[models.SupportTicketStatus]bool{
		models.SupportStatusOpen:       true,
		models.SupportStatusInProgress: true,
		models.SupportStatusClosed:     true,
	}
	if !allowed[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Недопустимый статус"})
		return
	}

	var ticket models.SupportTicket
	if err := h.db.First(&ticket, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Обращение не найдено"})
		return
	}

	oldStatus := ticket.Status
	h.db.Model(&ticket).Update("status", req.Status)

	// Notify user on status change
	if req.Status == models.SupportStatusClosed && oldStatus != models.SupportStatusClosed {
		CreateNotification(h.db, ticket.UserID, "",
			"Обращение закрыто",
			fmt.Sprintf("«%s»", ticket.Subject),
			fmt.Sprintf("/support/%d", ticket.ID),
		)
	} else if req.Status == models.SupportStatusOpen && oldStatus == models.SupportStatusClosed {
		CreateNotification(h.db, ticket.UserID, "",
			"Обращение открыто повторно",
			fmt.Sprintf("«%s»", ticket.Subject),
			fmt.Sprintf("/support/%d", ticket.ID),
		)
	}

	h.db.First(&ticket, id)
	c.JSON(http.StatusOK, ticket)
}

// GET /api/admin/support/unread-count
func (h *SupportHandler) AdminUnreadCount(c *gin.Context) {
	var count int64
	h.db.Model(&models.SupportTicket{}).
		Where("status IN ('open','in_progress')").
		Count(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (h *SupportHandler) saveAttachments(c *gin.Context, field string, maxCount int) ([]struct{ filename, originalName string; size int64 }, error) {
	form, _ := c.MultipartForm()
	var saved []struct{ filename, originalName string; size int64 }
	if form == nil {
		return saved, nil
	}
	files := form.File[field]
	if len(files) == 0 {
		return saved, nil
	}
	if maxCount > 0 && len(files) > maxCount {
		return saved, fmt.Errorf("максимум %d файлов", maxCount)
	}

	if err := os.MkdirAll(supportUploadsDir, 0700); err != nil {
		return saved, fmt.Errorf("ошибка создания директории")
	}

	for _, fh := range files {
		if fh.Size > supportMaxFileSizeBytes {
			return saved, fmt.Errorf("файл «%s» превышает 5 МБ", fh.Filename)
		}
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if !allowedSupportExts[ext] {
			return saved, fmt.Errorf("недопустимый формат «%s»", fh.Filename)
		}

		f, err := fh.Open()
		if err != nil {
			return saved, fmt.Errorf("ошибка чтения файла «%s»", fh.Filename)
		}
		mtype, _ := mimetype.DetectReader(f)
		f.Close()
		mimeBase := strings.ToLower(strings.TrimSpace(strings.SplitN(mtype.String(), ";", 2)[0]))
		if !allowedSupportMIMEs[mimeBase] {
			return saved, fmt.Errorf("содержимое файла «%s» не соответствует расширению", fh.Filename)
		}

		filename := uuid.New().String() + ext
		savePath := filepath.Join(supportUploadsDir, filename)
		if err := c.SaveUploadedFile(fh, savePath); err != nil {
			return saved, fmt.Errorf("ошибка сохранения файла")
		}
		saved = append(saved, struct{ filename, originalName string; size int64 }{filename, fh.Filename, fh.Size})
	}
	return saved, nil
}

func (h *SupportHandler) createAttachmentRecords(msgID uint, files []struct{ filename, originalName string; size int64 }, c *gin.Context) {
	for _, f := range files {
		h.db.Create(&models.SupportAttachment{
			MessageID:    msgID,
			Filename:     f.filename,
			OriginalName: f.originalName,
			FileSize:     f.size,
		})
	}
}

func (h *SupportHandler) cleanupFiles(files []struct{ filename, originalName string; size int64 }) {
	for _, f := range files {
		os.Remove(filepath.Join(supportUploadsDir, f.filename))
	}
}

func categoryLabel(cat models.SupportTicketCategory) string {
	switch cat {
	case models.SupportCategoryAccount:
		return "Личный кабинет"
	case models.SupportCategoryDocuments:
		return "Документы"
	case models.SupportCategorySchedule:
		return "Расписание занятий"
	case models.SupportCategorySiteError:
		return "Ошибка на сайте"
	default:
		return "Другое"
	}
}
