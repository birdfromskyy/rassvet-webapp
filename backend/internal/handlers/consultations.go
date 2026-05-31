package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ConsultationHandler struct {
	db *gorm.DB
}

func NewConsultationHandler(db *gorm.DB) *ConsultationHandler {
	return &ConsultationHandler{db: db}
}

var allowedContactMethods = map[string]bool{
	"phone": true,
	"vk":    true,
	"max":   true,
	"email": true,
}

// POST /api/consultations
// Available to guests (no auth) and authenticated users.
// Rate-limited via IPRateLimit middleware (3/day for guests, checked here for auth users).
func (h *ConsultationHandler) Create(c *gin.Context) {
	var body struct {
		ParentFio     string `json:"parent_fio"     binding:"required"`
		Phone         string `json:"phone"          binding:"required"`
		ChildFio      string `json:"child_fio"      binding:"required"`
		ChildAge      string `json:"child_age"      binding:"required"`
		ContactMethod string `json:"contact_method" binding:"required"`
		ContactEmail  string `json:"contact_email"`
		RequestText   string `json:"request_text"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Заполните все обязательные поля"})
		return
	}
	if !allowedContactMethods[body.ContactMethod] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Недопустимый способ связи"})
		return
	}
	if body.ContactMethod == "email" && strings.TrimSpace(body.ContactEmail) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите email для связи"})
		return
	}

	ip := c.ClientIP()

	// For authenticated users: allow only 1 open request at a time
	userID, isAuth := c.Get("userID")
	if isAuth {
		uid := userID.(uint)
		var existing models.ConsultationRequest
		if h.db.Where("user_id = ? AND status = 'new'", uid).First(&existing).Error == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "У вас уже есть активная заявка. Дождитесь ответа администратора."})
			return
		}
	}

	req := models.ConsultationRequest{
		ParentFio:     strings.TrimSpace(body.ParentFio),
		Phone:         strings.TrimSpace(body.Phone),
		ChildFio:      strings.TrimSpace(body.ChildFio),
		ChildAge:      strings.TrimSpace(body.ChildAge),
		ContactMethod: body.ContactMethod,
		ContactEmail:  strings.TrimSpace(body.ContactEmail),
		RequestText:   strings.TrimSpace(body.RequestText),
		IPAddress:     ip,
		Status:        "new",
	}
	if isAuth {
		uid := userID.(uint)
		req.UserID = &uid
	}

	h.db.Create(&req)

	// Notify all admins via in-app notification
	CreateNotification(h.db, 0, "admin",
		"Новая заявка на консультацию",
		"От: "+req.ParentFio+" | Ребёнок: "+req.ChildFio+" ("+req.ChildAge+")",
		"/admin/consultations",
	)

	c.JSON(http.StatusCreated, gin.H{"ok": true, "id": req.ID})
}

// GET /api/admin/consultations
func (h *ConsultationHandler) AdminList(c *gin.Context) {
	var list []models.ConsultationRequest
	h.db.Order("created_at DESC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// PUT /api/admin/consultations/:id
// Body: { "status": "new"|"contacted"|"closed", "admin_note": "..." }
func (h *ConsultationHandler) AdminUpdate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	var body struct {
		Status    string `json:"status"`
		AdminNote string `json:"admin_note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var req models.ConsultationRequest
	if err := h.db.First(&req, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	prevStatus := req.Status
	if body.Status != "" {
		req.Status = body.Status
	}
	req.AdminNote = body.AdminNote
	h.db.Save(&req)

	// Notify user if their request status changed and they have an account
	if req.UserID != nil && prevStatus != req.Status {
		var title, body_ string
		switch req.Status {
		case "contacted":
			title = "Мы связались с вами"
			body_ = "Администрация рассмотрела вашу заявку на консультацию. Ожидайте звонка или сообщения."
		case "closed":
			title = "Заявка на консультацию закрыта"
			body_ = "Ваша заявка на консультацию обработана и закрыта. Если остались вопросы — подайте новую заявку."
		}
		if title != "" {
			if body.AdminNote != "" {
				body_ += " Примечание: " + body.AdminNote
			}
			CreateNotification(h.db, *req.UserID, "", title, body_, "/dashboard")
		}
	}

	c.JSON(http.StatusOK, req)
}

// POST /api/admin/consultations/:id/anonymize
// Clears all PII fields, keeps the record with status and contact_method.
func (h *ConsultationHandler) AdminAnonymize(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	var req models.ConsultationRequest
	if err := h.db.First(&req, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}
	req.ParentFio = ""
	req.Phone = ""
	req.ChildFio = ""
	req.ChildAge = ""
	req.ContactEmail = ""
	req.RequestText = ""
	req.IPAddress = ""
	h.db.Save(&req)
	c.JSON(http.StatusOK, req)
}

// DELETE /api/admin/consultations/:id — permanently remove from DB
func (h *ConsultationHandler) AdminDelete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	h.db.Unscoped().Delete(&models.ConsultationRequest{}, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
