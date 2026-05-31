package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const questionnaireDir = "./private_uploads/questionnaires"

// Max uploads per user within the rate-limit window before a cooldown is imposed.
const questionnaireRateLimit = 3
const questionnaireRateWindow = 30 * time.Minute

type QuestionnaireHandler struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewQuestionnaireHandler(db *gorm.DB, rdb *redis.Client) *QuestionnaireHandler {
	return &QuestionnaireHandler{db: db, rdb: rdb}
}

var allowedQuestionnaireExts = map[string]bool{
	".pdf":  true,
	".doc":  true,
	".docx": true,
}

// GET /api/questionnaire — get current user's questionnaire
func (h *QuestionnaireHandler) GetMine(c *gin.Context) {
	userID := c.GetUint("userID")
	var q models.Questionnaire
	if err := h.db.Where("user_id = ?", userID).First(&q).Error; err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, q)
}

// POST /api/questionnaire — upload filled questionnaire (multipart, field: "file")
func (h *QuestionnaireHandler) Upload(c *gin.Context) {
	userID := c.GetUint("userID")
	ctx := context.Background()

	// Per-user rate limit: block after questionnaireRateLimit submissions in the window.
	rateKey := fmt.Sprintf("q_upload_rate:%d", userID)
	countStr, err := h.rdb.Get(ctx, rateKey).Result()
	if err == nil {
		count, _ := strconv.Atoi(countStr)
		if count >= questionnaireRateLimit {
			ttl, _ := h.rdb.TTL(ctx, rateKey).Result()
			mins := int(ttl.Minutes()) + 1
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": fmt.Sprintf("Слишком много отправок. Повторите примерно через %d мин.", mins),
			})
			return
		}
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Прикрепите файл анкеты"})
		return
	}
	if fh.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Файл превышает 10 МБ"})
		return
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedQuestionnaireExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Допустимые форматы: PDF, DOC, DOCX"})
		return
	}

	if err := os.MkdirAll(questionnaireDir, 0700); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания директории"})
		return
	}

	filename := uuid.New().String() + ext
	savePath := filepath.Join(questionnaireDir, filename)
	if err := c.SaveUploadedFile(fh, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения файла"})
		return
	}

	var q models.Questionnaire
	isNew := false
	if err := h.db.Where("user_id = ?", userID).First(&q).Error; err != nil {
		isNew = true
		q = models.Questionnaire{UserID: userID}
	} else {
		// Delete old file
		if q.FileName != "" {
			_ = os.Remove(filepath.Join(questionnaireDir, q.FileName))
		}
		// Reset status on re-upload
		q.Status = "pending"
		q.AdminNote = ""
	}

	q.FileName = filename
	q.Status = "pending"

	if isNew {
		h.db.Create(&q)
	} else {
		h.db.Save(&q)
	}

	// Increment rate-limit counter (only after successful save).
	newCount, _ := h.rdb.Incr(ctx, rateKey).Result()
	if newCount == 1 {
		h.rdb.Expire(ctx, rateKey, questionnaireRateWindow)
	}

	// Resolve user's display name for notification body.
	var user models.User
	fullName := ""
	if h.db.First(&user, userID).Error == nil {
		fullName = strings.TrimSpace(user.LastName + " " + user.FirstName)
	}
	if fullName == "" {
		fullName = fmt.Sprintf("пользователь #%d", userID)
	}

	notifTitle := "Новая анкета на проверку"
	notifLink := "/admin/questionnaires"
	// Embed user ID so we can find and replace old notifications on re-upload.
	notifBody := fmt.Sprintf("[uid:%d] Анкету загрузил(а) %s.", userID, fullName)

	// Delete any previous admin notifications about THIS user's questionnaire.
	var adminIDs []uint
	h.db.Model(&models.User{}).Where("role IN ('admin','superadmin')").Pluck("id", &adminIDs)
	if len(adminIDs) > 0 {
		marker := fmt.Sprintf("[uid:%d]", userID)
		h.db.Where("user_id IN ? AND title = ? AND body LIKE ?",
			adminIDs, notifTitle, marker+"%").
			Delete(&models.Notification{})
	}

	// Create fresh notifications for all admins.
	CreateNotification(h.db, 0, "admin", notifTitle, notifBody, notifLink)

	c.JSON(http.StatusOK, q)
}

// GET /api/questionnaire/file — serve private questionnaire file to its owner
func (h *QuestionnaireHandler) ServeFile(c *gin.Context) {
	userID := c.GetUint("userID")
	var q models.Questionnaire
	if err := h.db.Where("user_id = ?", userID).First(&q).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Анкета не найдена"})
		return
	}
	filePath := filepath.Join(questionnaireDir, q.FileName)
	if _, err := os.Stat(filePath); errors.Is(err, os.ErrNotExist) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}
	c.FileAttachment(filePath, q.FileName)
}

// ── Admin ──────────────────────────────────────────────────────────────────────

// GET /api/admin/questionnaires
func (h *QuestionnaireHandler) AdminList(c *gin.Context) {
	type row struct {
		models.Questionnaire
		UserEmail     string `json:"user_email"`
		UserFirstName string `json:"user_first_name"`
		UserLastName  string `json:"user_last_name"`
	}
	rows := make([]row, 0)
	h.db.Raw(`
		SELECT q.*, u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
		FROM questionnaires q
		JOIN users u ON u.id = q.user_id
		WHERE q.deleted_at IS NULL
		ORDER BY q.created_at DESC
	`).Scan(&rows)
	c.JSON(http.StatusOK, rows)
}

// GET /api/admin/questionnaires/:id/file — download filled questionnaire
func (h *QuestionnaireHandler) AdminServeFile(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var q models.Questionnaire
	if err := h.db.First(&q, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	filePath := filepath.Join(questionnaireDir, q.FileName)
	c.FileAttachment(filePath, q.FileName)
}

// POST /api/admin/questionnaires/:id/anonymize
// Deletes the file from disk and clears file_name, but keeps the record + status.
// Use this to comply with personal data regulations while preserving access rights.
func (h *QuestionnaireHandler) AdminAnonymize(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var q models.Questionnaire
	if err := h.db.First(&q, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	if q.FileName != "" {
		_ = os.Remove(filepath.Join(questionnaireDir, q.FileName))
	}
	q.FileName = ""
	h.db.Save(&q)
	c.JSON(http.StatusOK, q)
}

// DELETE /api/admin/questionnaires/:id — permanently remove record and file from DB
func (h *QuestionnaireHandler) AdminDelete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var q models.Questionnaire
	if err := h.db.First(&q, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	if q.FileName != "" {
		_ = os.Remove(filepath.Join(questionnaireDir, q.FileName))
	}
	h.db.Unscoped().Delete(&q)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PUT /api/admin/questionnaires/:id/status
// Body: { "status": "approved"|"rejected", "admin_note": "..." }
func (h *QuestionnaireHandler) AdminUpdateStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Status    string `json:"status"`
		AdminNote string `json:"admin_note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Status != "approved" && body.Status != "rejected" && body.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Статус: pending, approved или rejected"})
		return
	}

	var q models.Questionnaire
	if err := h.db.First(&q, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}

	prevStatus := q.Status
	q.Status = body.Status
	q.AdminNote = body.AdminNote
	h.db.Save(&q)

	// Notify user when status changes
	if prevStatus != body.Status {
		var notifTitle, notifBody string
		switch body.Status {
		case "approved":
			notifTitle = "Анкета принята"
			notifBody = "Ваша анкета проверена. Теперь вы можете подать документы для заключения договора."
		case "rejected":
			notifTitle = "Требуется уточнение по анкете"
			notifBody = "Пожалуйста, свяжитесь с администратором для уточнения деталей."
			if body.AdminNote != "" {
				notifBody += " Примечание: " + body.AdminNote
			}
		}
		if notifTitle != "" {
			CreateNotification(h.db, q.UserID, "", notifTitle, notifBody, "/profile")
		}
	}

	c.JSON(http.StatusOK, q)
}
