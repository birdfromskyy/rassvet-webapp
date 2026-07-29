package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	privateDocsDir      = "./private_uploads/docs"
	maxPassportFiles    = 7
	maxSnilsParentFiles = 1
	maxIppsuFiles       = 5
	maxBirthCertFiles   = 3
	maxSnilsChildFiles  = 1
	maxFileSizeBytes    = 5 * 1024 * 1024  // 5 MB per file
	maxChildTotalBytes  = 25 * 1024 * 1024 // 25 MB total per child submission
	maxParentTotalBytes = 15 * 1024 * 1024 // 15 MB total for parent docs
	maxChildren         = 5
)

var (
	allowedDocExts = map[string]bool{
		".pdf":  true,
		".jpg":  true,
		".jpeg": true,
		".png":  true,
	}
	allowedDocMIMEs = map[string]bool{
		"application/pdf": true,
		"image/jpeg":      true,
		"image/png":       true,
	}
	phoneRe = regexp.MustCompile(`^\+7\d{10}$`)
)

type DocumentHandler struct {
	db *gorm.DB
}

func NewDocumentHandler(db *gorm.DB) *DocumentHandler {
	return &DocumentHandler{db: db}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func parseFileList(raw string) []string {
	var list []string
	if raw == "" || raw == "null" {
		return list
	}
	_ = json.Unmarshal([]byte(raw), &list)
	return list
}

func marshalFileList(list []string) string {
	if list == nil {
		return "[]"
	}
	b, _ := json.Marshal(list)
	return string(b)
}

// saveDocFile saves one uploaded file into privateDocsDir and returns the filename (UUID.ext).
func saveDocFile(c *gin.Context, fieldName string) (string, int64, error) {
	fh, err := c.FormFile(fieldName)
	if err != nil {
		return "", 0, err
	}

	if fh.Size > maxFileSizeBytes {
		return "", 0, fmt.Errorf("файл «%s» превышает 5 МБ", fh.Filename)
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedDocExts[ext] {
		return "", 0, fmt.Errorf("недопустимый формат файла «%s» (разрешены PDF, JPG, PNG)", fh.Filename)
	}

	if err := os.MkdirAll(privateDocsDir, 0700); err != nil {
		return "", 0, errors.New("ошибка создания директории")
	}

	filename := uuid.New().String() + ext
	savePath := filepath.Join(privateDocsDir, filename)
	if err := c.SaveUploadedFile(fh, savePath); err != nil {
		return "", 0, errors.New("ошибка сохранения файла")
	}
	return filename, fh.Size, nil
}

// uploadMultipleFiles reads up to maxCount files from fields like "passport_files[0]",
// "passport_files[1]", etc.  It also handles a single field name repeated (multipart
// spec allows multiple values for the same key).
func (h *DocumentHandler) uploadMultipleFiles(c *gin.Context, fieldBase string, maxCount int) ([]string, int64, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return nil, 0, nil
	}

	files := form.File[fieldBase]
	var saved []string
	var totalSize int64

	for i, fh := range files {
		if i >= maxCount {
			return saved, totalSize, fmt.Errorf("максимум %d файлов для этого типа документа", maxCount)
		}
		if fh.Size > maxFileSizeBytes {
			return saved, totalSize, fmt.Errorf("файл «%s» превышает 5 МБ", fh.Filename)
		}
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if !allowedDocExts[ext] {
			return saved, totalSize, fmt.Errorf("недопустимый формат «%s» (разрешены PDF, JPG, PNG)", fh.Filename)
		}

		f, openErr := fh.Open()
		if openErr != nil {
			return saved, totalSize, fmt.Errorf("ошибка чтения файла «%s»", fh.Filename)
		}
		mtype, _ := mimetype.DetectReader(f)
		f.Close()
		mimeBase := strings.ToLower(strings.TrimSpace(strings.SplitN(mtype.String(), ";", 2)[0]))
		if !allowedDocMIMEs[mimeBase] {
			return saved, totalSize, fmt.Errorf("содержимое файла «%s» не соответствует расширению (разрешены PDF, JPG, PNG)", fh.Filename)
		}

		totalSize += fh.Size
		if err := os.MkdirAll(privateDocsDir, 0700); err != nil {
			return saved, totalSize, errors.New("ошибка создания директории")
		}

		filename := uuid.New().String() + ext
		savePath := filepath.Join(privateDocsDir, filename)
		if err := c.SaveUploadedFile(fh, savePath); err != nil {
			return saved, totalSize, errors.New("ошибка сохранения файла")
		}
		saved = append(saved, filename)
	}
	return saved, totalSize, nil
}

// deletePhysicalFiles removes files from disk that are in oldList but not in keepList.
func deletePhysicalFiles(oldList, keepList []string) {
	keepSet := make(map[string]bool, len(keepList))
	for _, f := range keepList {
		keepSet[f] = true
	}
	for _, f := range oldList {
		if !keepSet[f] {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
	}
}

// userOwnsFile checks if filename appears in any of the user's stored doc lists.
func (h *DocumentHandler) userOwnsFile(userID uint, filename string) bool {
	var profile models.ParentProfile
	if err := h.db.Where("user_id = ?", userID).First(&profile).Error; err == nil {
		for _, f := range parseFileList(profile.PassportFiles) {
			if f == filename {
				return true
			}
		}
		for _, f := range parseFileList(profile.SnilsFiles) {
			if f == filename {
				return true
			}
		}
	}

	var children []models.ChildDocSubmission
	h.db.Where("user_id = ?", userID).Find(&children)
	for _, ch := range children {
		for _, f := range parseFileList(ch.IppsuFiles) {
			if f == filename {
				return true
			}
		}
		for _, f := range parseFileList(ch.BirthCertFiles) {
			if f == filename {
				return true
			}
		}
		for _, f := range parseFileList(ch.ChildSnilsFiles) {
			if f == filename {
				return true
			}
		}
	}
	return false
}

// ─── User endpoints ───────────────────────────────────────────────────────────

// GET /api/documents
func (h *DocumentHandler) GetMyDocuments(c *gin.Context) {
	userID := c.GetUint("userID")

	var profile models.ParentProfile
	h.db.Where("user_id = ?", userID).First(&profile)

	var children []models.ChildDocSubmission
	h.db.Where("user_id = ?", userID).Order("created_at asc").Find(&children)

	c.JSON(http.StatusOK, gin.H{
		"parent_profile": profile,
		"children":       children,
	})
}

// POST /api/documents/parent  (multipart/form-data)
func (h *DocumentHandler) SaveParentDocs(c *gin.Context) {
	userID := c.GetUint("userID")
	if !h.checkQuestionnaireApproved(c, userID) {
		return
	}

	phone := strings.TrimSpace(c.PostForm("phone"))
	if phone != "" && !phoneRe.MatchString(phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат телефона. Используйте +7XXXXXXXXXX (10 цифр после +7)"})
		return
	}

	// Load or create profile
	var profile models.ParentProfile
	isNew := false
	if err := h.db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		profile = models.ParentProfile{UserID: userID}
		isNew = true
	}

	// Parse which existing files to keep
	keepPassport := parseFileList(c.PostForm("keep_passport"))
	keepSnils := parseFileList(c.PostForm("keep_snils"))

	// Delete physical files that the user removed
	deletePhysicalFiles(parseFileList(profile.PassportFiles), keepPassport)
	deletePhysicalFiles(parseFileList(profile.SnilsFiles), keepSnils)

	// Upload new files
	newPassport, passportSize, err := h.uploadMultipleFiles(c, "passport_files", maxPassportFiles-len(keepPassport))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	newSnils, snilsSize, err := h.uploadMultipleFiles(c, "snils_files", maxSnilsParentFiles-len(keepSnils))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Total size guard
	if passportSize+snilsSize > maxParentTotalBytes {
		// Rollback newly saved files
		for _, f := range append(newPassport, newSnils...) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Суммарный размер загружаемых файлов превышает 15 МБ"})
		return
	}

	finalPassport := append(keepPassport, newPassport...)
	finalSnils := append(keepSnils, newSnils...)

	if len(finalPassport) > maxPassportFiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Максимум %d файлов для паспорта", maxPassportFiles)})
		return
	}
	if len(finalSnils) > maxSnilsParentFiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Максимум %d файл для СНИЛС", maxSnilsParentFiles)})
		return
	}

	profile.Phone = phone
	profile.PassportFiles = marshalFileList(finalPassport)
	profile.SnilsFiles = marshalFileList(finalSnils)

	hasFiles := len(finalPassport) > 0 || len(finalSnils) > 0
	if hasFiles || phone != "" {
		profile.Status = "pending"
		profile.AdminNote = ""
		now := time.Now()
		profile.SubmittedAt = &now
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if isNew {
			return tx.Create(&profile).Error
		}
		return tx.Save(&profile).Error
	}); err != nil {
		// Rollback newly uploaded files to avoid orphans
		for _, f := range append(newPassport, newSnils...) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения документов"})
		return
	}

	// Notify admins that parent documents were submitted
	if hasFiles || phone != "" {
		var user models.User
		fullName := fmt.Sprintf("пользователь #%d", userID)
		if h.db.First(&user, userID).Error == nil {
			fullName = strings.TrimSpace(user.LastName + " " + user.FirstName)
		}
		CreateNotification(h.db, 0, "admin",
			"Документы родителя поданы на проверку",
			fmt.Sprintf("%s загрузил(а) документы родителя.", fullName),
			"/admin/documents",
		)
	}

	c.JSON(http.StatusOK, gin.H{"parent_profile": profile})
}

// checkQuestionnaireApproved returns an error response if user has no approved questionnaire.
func (h *DocumentHandler) checkQuestionnaireApproved(c *gin.Context, userID uint) bool {
	var q models.Questionnaire
	if err := h.db.Where("user_id = ? AND status = 'approved'", userID).First(&q).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Подача документов доступна только после проверки анкеты. Пожалуйста, загрузите заполненную анкету и дождитесь подтверждения администратора.",
		})
		return false
	}
	return true
}

// POST /api/documents/children  (multipart/form-data)
// Fields:
//
//	child_name         — required
//	ippsu_files[]      — up to 10 files
//	birth_cert_files[] — up to 10 files
//	child_snils_files[]— up to 10 files
func (h *DocumentHandler) AddChildDocs(c *gin.Context) {
	userID := c.GetUint("userID")
	if !h.checkQuestionnaireApproved(c, userID) {
		return
	}

	// Count existing children
	var count int64
	h.db.Model(&models.ChildDocSubmission{}).Where("user_id = ? AND deleted_at IS NULL", userID).Count(&count)
	if count >= maxChildren {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Максимальное количество детей — %d", maxChildren)})
		return
	}

	childName := strings.TrimSpace(c.PostForm("child_name"))
	if childName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите имя ребёнка"})
		return
	}

	ippsuFiles, ippsuSize, err := h.uploadMultipleFiles(c, "ippsu_files", maxIppsuFiles)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	birthFiles, birthSize, err := h.uploadMultipleFiles(c, "birth_cert_files", maxBirthCertFiles)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	snilsFiles, snilsSize, err := h.uploadMultipleFiles(c, "child_snils_files", maxSnilsChildFiles)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	totalSize := ippsuSize + birthSize + snilsSize
	if totalSize > maxChildTotalBytes {
		for _, f := range append(append(ippsuFiles, birthFiles...), snilsFiles...) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Суммарный размер файлов ребёнка превышает 25 МБ"})
		return
	}

	sub := models.ChildDocSubmission{
		UserID:          userID,
		ChildName:       childName,
		IppsuFiles:      marshalFileList(ippsuFiles),
		BirthCertFiles:  marshalFileList(birthFiles),
		ChildSnilsFiles: marshalFileList(snilsFiles),
		Status:          "pending",
	}
	if err := h.db.Create(&sub).Error; err != nil {
		// Rollback newly uploaded files to avoid orphans
		for _, f := range append(append(ippsuFiles, birthFiles...), snilsFiles...) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения документов"})
		return
	}

	// Notify admins that child documents were submitted
	{
		var user models.User
		fullName := fmt.Sprintf("пользователь #%d", userID)
		if h.db.First(&user, userID).Error == nil {
			fullName = strings.TrimSpace(user.LastName + " " + user.FirstName)
		}
		CreateNotification(h.db, 0, "admin",
			"Документы ребёнка поданы на проверку",
			fmt.Sprintf("%s загрузил(а) документы ребёнка «%s».", fullName, childName),
			"/admin/documents",
		)
	}

	c.JSON(http.StatusCreated, gin.H{"submission": sub})
}

// DELETE /api/documents/children/:id
func (h *DocumentHandler) DeleteChildSubmission(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var sub models.ChildDocSubmission
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	// Remove physical files
	for _, f := range parseFileList(sub.IppsuFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.BirthCertFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.ChildSnilsFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}

	h.db.Delete(&sub)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PUT /api/documents/children/:id  (multipart/form-data)
// Allowed only when submission status is "rejected".
// Fields mirror AddChildDocs but also accept keep_* arrays for existing files.
func (h *DocumentHandler) UpdateChildDocs(c *gin.Context) {
	userID := c.GetUint("userID")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var sub models.ChildDocSubmission
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}
	childName := strings.TrimSpace(c.PostForm("child_name"))
	if childName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите имя ребёнка"})
		return
	}

	keepIppsu := parseFileList(c.PostForm("keep_ippsu_files"))
	keepBirth := parseFileList(c.PostForm("keep_birth_cert_files"))
	keepSnils := parseFileList(c.PostForm("keep_child_snils_files"))

	deletePhysicalFiles(parseFileList(sub.IppsuFiles), keepIppsu)
	deletePhysicalFiles(parseFileList(sub.BirthCertFiles), keepBirth)
	deletePhysicalFiles(parseFileList(sub.ChildSnilsFiles), keepSnils)

	newIppsu, ippsuSize, err := h.uploadMultipleFiles(c, "ippsu_files", maxIppsuFiles-len(keepIppsu))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	newBirth, birthSize, err := h.uploadMultipleFiles(c, "birth_cert_files", maxBirthCertFiles-len(keepBirth))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	newSnilsFiles, snilsSize, err := h.uploadMultipleFiles(c, "child_snils_files", maxSnilsChildFiles-len(keepSnils))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if ippsuSize+birthSize+snilsSize > maxChildTotalBytes {
		for _, f := range append(append(newIppsu, newBirth...), newSnilsFiles...) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Суммарный размер файлов ребёнка превышает 25 МБ"})
		return
	}

	finalIppsu := append(keepIppsu, newIppsu...)
	finalBirth := append(keepBirth, newBirth...)
	finalSnils := append(keepSnils, newSnilsFiles...)

	sub.ChildName = childName
	sub.IppsuFiles = marshalFileList(finalIppsu)
	sub.BirthCertFiles = marshalFileList(finalBirth)
	sub.ChildSnilsFiles = marshalFileList(finalSnils)
	sub.Status = "pending"
	sub.AdminNote = ""
	h.db.Save(&sub)

	// Notify admins that the previously rejected child documents were updated and resubmitted
	{
		var user models.User
		fullName := fmt.Sprintf("пользователь #%d", userID)
		if h.db.First(&user, userID).Error == nil {
			fullName = strings.TrimSpace(user.LastName + " " + user.FirstName)
		}
		CreateNotification(h.db, 0, "admin",
			"Документы ребёнка обновлены после отклонения",
			fmt.Sprintf("%s обновил(а) документы ребёнка «%s» и отправил(а) их на повторную проверку.", fullName, childName),
			"/admin/documents",
		)
	}

	c.JSON(http.StatusOK, gin.H{"submission": sub})
}

// GET /api/documents/file/:filename
// Auth is handled by AuthMiddleware (httpOnly cookie). userID and role come from context.
// Authenticated users may access their own files; admins may access any file.
func (h *DocumentHandler) ServePrivateFile(c *gin.Context) {
	filename := c.Param("filename")

	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное имя файла"})
		return
	}

	userID := c.GetUint("userID")
	role := c.GetString("role")

	if !models.IsAdminRole(role) && !h.userOwnsFile(userID, filename) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
		return
	}

	filePath := filepath.Join(privateDocsDir, filename)
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

// DELETE /api/admin/documents/submissions/:id
// Admin permanently deletes a single child doc submission + its files.
func (h *DocumentHandler) AdminDeleteSubmission(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var sub models.ChildDocSubmission
	if err := h.db.First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	for _, f := range parseFileList(sub.IppsuFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.BirthCertFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.ChildSnilsFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}

	h.db.Unscoped().Delete(&sub)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /api/admin/documents/submissions/:id/anonymize
// Deletes files from disk and clears PII (child name, file lists), keeps record + status.
func (h *DocumentHandler) AdminAnonymizeSubmission(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	var sub models.ChildDocSubmission
	if err := h.db.First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}
	for _, f := range parseFileList(sub.IppsuFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.BirthCertFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(sub.ChildSnilsFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	sub.ChildName = ""
	sub.IppsuFiles = "[]"
	sub.BirthCertFiles = "[]"
	sub.ChildSnilsFiles = "[]"
	h.db.Save(&sub)
	c.JSON(http.StatusOK, sub)
}

// deleteUserChildren removes all child submissions + physical files for a user.
func (h *DocumentHandler) deleteUserChildren(userId int) {
	var children []models.ChildDocSubmission
	h.db.Unscoped().Where("user_id = ?", userId).Find(&children)
	for _, ch := range children {
		for _, f := range parseFileList(ch.IppsuFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileList(ch.BirthCertFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileList(ch.ChildSnilsFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		h.db.Unscoped().Delete(&ch)
	}
}

// deleteUserParentProfile removes parent profile record + physical files for a user.
func (h *DocumentHandler) deleteUserParentProfile(userId int) {
	var profile models.ParentProfile
	if err := h.db.Unscoped().Where("user_id = ?", userId).First(&profile).Error; err == nil {
		for _, f := range parseFileList(profile.PassportFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		for _, f := range parseFileList(profile.SnilsFiles) {
			_ = os.Remove(filepath.Join(privateDocsDir, f))
		}
		h.db.Unscoped().Delete(&profile)
	}
}

// DELETE /api/documents/parent
// Allows the authenticated user to delete their own parent profile (files + record).
func (h *DocumentHandler) DeleteMyParentProfile(c *gin.Context) {
	userID := c.GetUint("userID")
	h.deleteUserParentProfile(int(userID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/admin/documents/parent/:userId
// Removes the parent profile record (phone + files) for a specific user.
func (h *DocumentHandler) AdminDeleteParentProfile(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}
	h.deleteUserParentProfile(userId)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/admin/documents/user/:userId/personal-data
// POST /api/admin/documents/parent/:userId/anonymize
// Deletes physical passport/SNILS files and clears PII, but keeps the profile record + status.
func (h *DocumentHandler) AdminAnonymizeParentProfile(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}
	var profile models.ParentProfile
	if err := h.db.Where("user_id = ?", userId).First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Профиль не найден"})
		return
	}
	for _, f := range parseFileList(profile.PassportFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	for _, f := range parseFileList(profile.SnilsFiles) {
		_ = os.Remove(filepath.Join(privateDocsDir, f))
	}
	profile.Phone = ""
	profile.PassportFiles = "[]"
	profile.SnilsFiles = "[]"
	h.db.Save(&profile)
	c.JSON(http.StatusOK, gin.H{"parent_profile": profile})
}

// Erases ALL personal data: child submissions + parent profile.
func (h *DocumentHandler) AdminDeletePersonalData(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}
	h.deleteUserChildren(userId)
	h.deleteUserParentProfile(userId)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /api/admin/documents
// Returns all users that have a parent profile or child submissions.
func (h *DocumentHandler) AdminListDocuments(c *gin.Context) {
	type UserDoc struct {
		UserID   uint                        `json:"user_id"`
		Email    string                      `json:"email"`
		FullName string                      `json:"full_name"`
		Profile  *models.ParentProfile       `json:"parent_profile"`
		Children []models.ChildDocSubmission `json:"children"`
	}

	// Collect all profiles
	var profiles []models.ParentProfile
	h.db.Find(&profiles)

	// Collect all child submissions
	var allChildren []models.ChildDocSubmission
	h.db.Order("user_id, created_at").Find(&allChildren)

	// Build user-id sets
	userIDs := make(map[uint]bool)
	for _, p := range profiles {
		userIDs[p.UserID] = true
	}
	for _, ch := range allChildren {
		userIDs[ch.UserID] = true
	}

	// Load users
	var ids []uint
	for id := range userIDs {
		ids = append(ids, id)
	}
	var users []models.User
	if len(ids) > 0 {
		h.db.Where("id IN ?", ids).Find(&users)
	}

	// Index by user ID
	userMap := make(map[uint]models.User, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}
	profileMap := make(map[uint]*models.ParentProfile, len(profiles))
	for i := range profiles {
		profileMap[profiles[i].UserID] = &profiles[i]
	}
	childrenMap := make(map[uint][]models.ChildDocSubmission)
	for _, ch := range allChildren {
		childrenMap[ch.UserID] = append(childrenMap[ch.UserID], ch)
	}

	result := make([]UserDoc, 0, len(userIDs))
	for id := range userIDs {
		u := userMap[id]
		fullName := strings.Join(filterEmpty([]string{u.LastName, u.FirstName, u.MiddleName}), " ")
		result = append(result, UserDoc{
			UserID:   id,
			Email:    u.Email,
			FullName: fullName,
			Profile:  profileMap[id],
			Children: childrenMap[id],
		})
	}

	c.JSON(http.StatusOK, result)
}

// PUT /api/admin/documents/submissions/:id/status
// Body: { "status": "approved"|"rejected"|"pending", "admin_note": "...", "ippsu_expiry_date": "2027-01-01" }
func (h *DocumentHandler) AdminUpdateSubmissionStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var body struct {
		Status          string `json:"status"`
		AdminNote       string `json:"admin_note"`
		IppsuExpiryDate string `json:"ippsu_expiry_date"` // "YYYY-MM-DD"
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Status != "approved" && body.Status != "rejected" && body.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Статус должен быть: pending, approved или rejected"})
		return
	}

	var sub models.ChildDocSubmission
	if err := h.db.First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	prevStatus := sub.Status
	sub.Status = body.Status
	sub.AdminNote = body.AdminNote

	if body.IppsuExpiryDate != "" {
		t, parseErr := time.Parse("2006-01-02", body.IppsuExpiryDate)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат даты (ожидается ГГГГ-ММ-ДД)"})
			return
		}
		dateChanged := sub.IppsuExpiryDate == nil ||
			sub.IppsuExpiryDate.Format("2006-01-02") != t.Format("2006-01-02")
		sub.IppsuExpiryDate = &t
		if dateChanged {
			sub.ExpiryNotified = false
			sub.ExpiryReminderNotified = false
		}
	}

	h.db.Save(&sub)

	// Create in-app notification when status changes to approved or rejected
	if prevStatus != body.Status && (body.Status == "approved" || body.Status == "rejected") {
		title, notifBody, link := "", "", "/profile"
		if body.Status == "approved" {
			title = fmt.Sprintf("Документы приняты: %s", sub.ChildName)
			notifBody = "Пакет документов проверен и принят администратором."
			if body.AdminNote != "" {
				notifBody += " Примечание: " + body.AdminNote
			}
		} else {
			title = fmt.Sprintf("Документы отклонены: %s", sub.ChildName)
			notifBody = "Пакет документов был отклонён."
			if body.AdminNote != "" {
				notifBody += " Причина: " + body.AdminNote
			}
		}
		CreateNotification(h.db, sub.UserID, "", title, notifBody, link)
	}

	c.JSON(http.StatusOK, gin.H{"submission": sub})
}

// PUT /api/admin/documents/parent/:userId/status
// Body: { "status": "pending"|"approved"|"rejected", "admin_note": "..." }
func (h *DocumentHandler) AdminUpdateParentStatus(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
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
	if body.Status != "pending" && body.Status != "approved" && body.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Статус должен быть: pending, approved или rejected"})
		return
	}

	var profile models.ParentProfile
	if err := h.db.Where("user_id = ?", userId).First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Профиль не найден"})
		return
	}

	prevStatus := profile.Status
	profile.Status = body.Status
	profile.AdminNote = body.AdminNote
	h.db.Save(&profile)

	if prevStatus != body.Status {
		switch body.Status {
		case "approved":
			notifBody := "Ваши личные документы (паспорт, СНИЛС) проверены и приняты администратором."
			if body.AdminNote != "" {
				notifBody += " Примечание: " + body.AdminNote
			}
			CreateNotification(h.db, profile.UserID, "", "Документы родителя приняты", notifBody, "/profile")
		case "rejected":
			notifBody := "Ваши личные документы (паспорт, СНИЛС) были отклонены администратором. Пожалуйста, загрузите документы повторно."
			if body.AdminNote != "" {
				notifBody += " Причина: " + body.AdminNote
			}
			CreateNotification(h.db, profile.UserID, "", "Документы родителя отклонены", notifBody, "/profile")
		}
	}

	c.JSON(http.StatusOK, gin.H{"parent_profile": profile})
}

// helper to filter out empty strings
func filterEmpty(ss []string) []string {
	var out []string
	for _, s := range ss {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}
