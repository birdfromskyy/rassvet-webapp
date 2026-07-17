package handlers

import (
	"backend/internal/middleware"
	"backend/internal/models"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// privileged roles that only a superadmin may assign or affect
var privilegedRoles = map[string]bool{"admin": true, "superadmin": true}

type UserStudentHandler struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewUserStudentHandler(db *gorm.DB, redisClients ...*redis.Client) *UserStudentHandler {
	h := &UserStudentHandler{db: db}
	if len(redisClients) > 0 {
		h.rdb = redisClients[0]
	}
	return h
}

func (h *UserStudentHandler) revokeSessions(c *gin.Context, userID uint) {
	if h.rdb == nil {
		return
	}
	key := userSessionsKey(userID)
	if tokens, err := h.rdb.SMembers(c.Request.Context(), key).Result(); err == nil {
		for _, token := range tokens {
			_ = h.rdb.Del(c.Request.Context(), refreshKey(token)).Err()
		}
	}
	_ = h.rdb.Del(c.Request.Context(), key).Err()
	accessKey := userAccessTokensKey(userID)
	if tokens, err := h.rdb.SMembers(c.Request.Context(), accessKey).Result(); err == nil {
		for _, token := range tokens {
			_ = h.rdb.Set(c.Request.Context(), "blacklist:"+token, "1", time.Duration(accessTokenMaxAge)*time.Second).Err()
		}
	}
	_ = h.rdb.Del(c.Request.Context(), accessKey).Err()
}

// Admin: GET /api/admin/users
func (h *UserStudentHandler) GetUsers(c *gin.Context) {
	var users []models.User
	if err := h.db.Order("id ASC").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения пользователей"})
		return
	}

	// Children counts for every user in ONE aggregate query. Previously the
	// admin UI fetched /users/:id/children per row (N+1) — ~60 parallel
	// requests on page load, which flooded clients' networks.
	type countRow struct {
		UserID uint
		Count  int
	}
	var rows []countRow
	h.db.Model(&models.UserStudent{}).
		Select("user_id, COUNT(*) as count").
		Group("user_id").
		Scan(&rows)
	counts := make(map[uint]int, len(rows))
	for _, r := range rows {
		counts[r.UserID] = r.Count
	}

	c.JSON(http.StatusOK, gin.H{"users": users, "children_counts": counts})
}

type CreateUserRequest struct {
	Email      string `json:"email" binding:"required"`
	Password   string `json:"password" binding:"required,min=6"`
	FirstName  string `json:"first_name" binding:"required"`
	LastName   string `json:"last_name" binding:"required"`
	MiddleName string `json:"middle_name"`
	Role       string `json:"role"`
}

// Admin: POST /api/admin/users
func (h *UserStudentHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check email uniqueness
	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	role := req.Role
	validRoles := map[string]bool{"user": true, "teacher": true, "admin": true, "superadmin": true}
	if !validRoles[role] {
		role = "user"
	}
	// Superadmin role cannot be assigned via UI — use the database directly
	if role == "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Роль суперадминистратора назначается только через базу данных"})
		return
	}
	// Only superadmin can create admin accounts
	if role == "admin" && !middleware.IsSuperAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Только суперадминистратор может назначать роль администратора"})
		return
	}

	isVerified := true
	now := time.Now()
	user := models.User{
		Email:          req.Email,
		Password:       string(hashedPassword),
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		MiddleName:     req.MiddleName,
		Role:           models.UserRole(role),
		IsVerified:     isVerified,
		ConsentGivenAt: &now,
		ConsentVersion: currentConsentVersion,
	}

	if err := h.db.Select("Email", "Password", "FirstName", "LastName", "MiddleName", "Role", "IsVerified", "ConsentGivenAt", "ConsentVersion").Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать пользователя"})
		return
	}

	user.Password = ""
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

type UpdateUserRequest struct {
	Email      string `json:"email" binding:"required"`
	Password   string `json:"password"`
	FirstName  string `json:"first_name" binding:"required"`
	LastName   string `json:"last_name" binding:"required"`
	MiddleName string `json:"middle_name"`
	Role       string `json:"role"`
}

// Admin: PUT /api/admin/users/:id
func (h *UserStudentHandler) UpdateUser(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения пользователя"})
		return
	}

	// Check email uniqueness if changed
	if user.Email != req.Email {
		var existing models.User
		if err := h.db.Where("email = ? AND id != ?", req.Email, userID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
			return
		}
	}

	// Superadmin profile (name/email/password/role) cannot be edited by anyone — not even another superadmin.
	callerID := extractUserID(c)
	if string(user.Role) == "superadmin" && callerID != uint(userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Нельзя редактировать профиль другого суперадминистратора"})
		return
	}
	// Superadmin role is immutable via the UI — change it directly in the database.
	if string(user.Role) == "superadmin" && req.Role != "" && req.Role != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Роль суперадминистратора нельзя изменить через интерфейс"})
		return
	}

	role := req.Role
	validRolesUpd := map[string]bool{"user": true, "teacher": true, "admin": true, "superadmin": true}
	if !validRolesUpd[role] {
		role = string(user.Role)
	}
	// Regular admin cannot touch privileged accounts or assign privileged roles
	if !middleware.IsSuperAdmin(c) {
		if privilegedRoles[string(user.Role)] {
			c.JSON(http.StatusForbidden, gin.H{"error": "Нельзя редактировать администратора"})
			return
		}
		if privilegedRoles[role] {
			c.JSON(http.StatusForbidden, gin.H{"error": "Только суперадминистратор может назначать роль администратора"})
			return
		}
	}
	// Even a superadmin cannot assign the superadmin role via UI
	if role == "superadmin" && string(user.Role) != "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Роль суперадминистратора назначается только через базу данных"})
		return
	}

	user.Email = req.Email
	user.FirstName = req.FirstName
	user.LastName = req.LastName
	user.MiddleName = req.MiddleName
	user.Role = models.UserRole(role)

	fields := []string{"Email", "FirstName", "LastName", "MiddleName", "Role"}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		user.Password = string(hashedPassword)
		fields = append(fields, "Password")
	}

	if err := h.db.Select(fields).Save(&user).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить пользователя"})
		return
	}
	if req.Password != "" {
		h.revokeSessions(c, user.ID)
	}

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// Admin: DELETE /api/admin/users/:id — cascade delete user and all related data
func (h *UserStudentHandler) DeleteUser(c *gin.Context) {
	targetID, err := strconv.Atoi(c.Param("id"))
	if err != nil || targetID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	// Prevent self-deletion
	callerID := extractUserID(c)
	if callerID == uint(targetID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Нельзя удалить собственный аккаунт"})
		return
	}

	var user models.User
	if err := h.db.First(&user, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	// Superadmin accounts cannot be deleted via UI — manage them directly in the database
	if string(user.Role) == "superadmin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Суперадминистраторов нельзя удалить через интерфейс"})
		return
	}
	// Regular admin cannot delete other admins
	if !middleware.IsSuperAdmin(c) && string(user.Role) == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Нельзя удалить администратора"})
		return
	}

	// Delete questionnaire file from disk before removing DB record
	var q models.Questionnaire
	if h.db.Where("user_id = ?", targetID).First(&q).Error == nil && q.FileName != "" {
		_ = os.Remove(filepath.Join("./private_uploads/questionnaires", q.FileName))
	}

	// Delete physical files for child doc submissions
	var children []models.ChildDocSubmission
	h.db.Unscoped().Where("user_id = ?", targetID).Find(&children)
	for _, ch := range children {
		for _, f := range parseFileList(ch.IppsuFiles) {
			_ = os.Remove(filepath.Join("./private_uploads/docs", f))
		}
		for _, f := range parseFileList(ch.BirthCertFiles) {
			_ = os.Remove(filepath.Join("./private_uploads/docs", f))
		}
		for _, f := range parseFileList(ch.ChildSnilsFiles) {
			_ = os.Remove(filepath.Join("./private_uploads/docs", f))
		}
	}

	// Delete physical files for parent profile
	var profile models.ParentProfile
	if h.db.Unscoped().Where("user_id = ?", targetID).First(&profile).Error == nil {
		for _, f := range parseFileList(profile.PassportFiles) {
			_ = os.Remove(filepath.Join("./private_uploads/docs", f))
		}
		for _, f := range parseFileList(profile.SnilsFiles) {
			_ = os.Remove(filepath.Join("./private_uploads/docs", f))
		}
	}

	// Support messages may belong either to the deleted user's own tickets or
	// to another user's ticket (for example, an administrator reply). Delete
	// attachments first so neither database records nor private files remain.
	var supportMessages []models.SupportMessage
	h.db.Where("sender_id = ? OR ticket_id IN (?)", targetID,
		h.db.Model(&models.SupportTicket{}).Select("id").Where("user_id = ?", targetID),
	).Find(&supportMessages)
	messageIDs := make([]uint, 0, len(supportMessages))
	for _, message := range supportMessages {
		messageIDs = append(messageIDs, message.ID)
	}
	if len(messageIDs) > 0 {
		var attachments []models.SupportAttachment
		h.db.Where("message_id IN ?", messageIDs).Find(&attachments)
		for _, attachment := range attachments {
			_ = os.Remove(filepath.Join(supportUploadsDir, attachment.Filename))
		}
		h.db.Where("message_id IN ?", messageIDs).Delete(&models.SupportAttachment{})
		h.db.Where("id IN ?", messageIDs).Delete(&models.SupportMessage{})
	}
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.SupportTicket{})

	// Cascade: remove all related records (hard delete via Unscoped)
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.Questionnaire{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.Notification{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.Review{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.ConsultationRequest{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.UserStudent{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.ChildDocSubmission{})
	h.db.Unscoped().Where("user_id = ?", targetID).Delete(&models.ParentProfile{})
	// A teacher is shared between accounts; only its link to this account is removed.
	h.db.Where("user_id = ?", targetID).Delete(&models.TeacherUserLink{})

	// Hard-delete the user so the email can be reused
	h.db.Unscoped().Delete(&user)
	h.revokeSessions(c, user.ID)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Admin: GET /api/admin/users/:id/children
func (h *UserStudentHandler) GetUserChildren(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var links []models.UserStudent
	if err := h.db.Where("user_id = ?", userID).Preload("Student").Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения списка детей"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"children": links})
}

type AddChildRequest struct {
	StudentID uint `json:"student_id" binding:"required"`
}

// Admin: POST /api/admin/users/:id/children
func (h *UserStudentHandler) AddUserChild(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var req AddChildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
		return
	}

	link := models.UserStudent{
		UserID:    uint(userID),
		StudentID: req.StudentID,
	}

	if err := h.db.Create(&link).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Этот ученик уже привязан к данному пользователю"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось привязать ученика"})
		return
	}

	h.db.Preload("Student").First(&link, link.ID)
	c.JSON(http.StatusCreated, gin.H{"link": link})
}

// Admin: DELETE /api/admin/users/:id/children/:studentId
func (h *UserStudentHandler) RemoveUserChild(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID ученика"})
		return
	}

	result := h.db.Where("user_id = ? AND student_id = ?", userID, studentID).Delete(&models.UserStudent{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось отвязать ученика"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Связь не найдена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Child removed successfully"})
}

// Protected: GET /api/my-children
func (h *UserStudentHandler) GetMyChildren(c *gin.Context) {
	userID := extractUserID(c)

	var links []models.UserStudent
	if err := h.db.Where("user_id = ?", userID).Preload("Student").Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения списка детей"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"children": links})
}

// Protected: GET /api/my-children/:studentId/schedule?week_start=YYYY-MM-DD
func (h *UserStudentHandler) GetChildSchedule(c *gin.Context) {
	userID := extractUserID(c)

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID ученика"})
		return
	}

	// Verify parent-child link
	var link models.UserStudent
	if err := h.db.Where("user_id = ? AND student_id = ?", userID, studentID).First(&link).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён: этот ученик не привязан к вашему аккаунту"})
		return
	}

	weekStart := c.Query("week_start")
	if weekStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start обязателен"})
		return
	}

	parsedWeekStart, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start должен быть в формате YYYY-MM-DD"})
		return
	}

	// Only approved schedules are visible to parents
	var schedule models.Schedule
	if err := h.db.Where("week_start_date = ? AND status = ?", parsedWeekStart, models.ScheduleStatusApproved).First(&schedule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Опубликованное расписание на эту неделю не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	// Load all slots with full preloads
	var allSlots []models.ScheduleSlot
	if err := h.db.
		Preload("Teacher").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLessonAttendance").
		Preload("Teachers.Teacher").
		Where("schedule_id = ? AND status != ?", schedule.ID, models.ScheduleSlotStatusCancelled).
		Order("weekday ASC, start_time ASC").
		Find(&allSlots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения слотов"})
		return
	}

	// Filter slots relevant to this student
	filteredSlots := []models.ScheduleSlot{}
	for _, slot := range allSlots {
		if slot.SlotType == models.SlotTypeIndividual && slot.StudentID != nil && *slot.StudentID == uint(studentID) {
			filteredSlots = append(filteredSlots, slot)
		} else if slot.SlotType == models.SlotTypeGroup && slotHasPublishedStudent(slot, uint(studentID)) {
			filteredSlots = append(filteredSlots, slot)
		}
	}

	var student models.Student
	h.db.First(&student, studentID)

	c.JSON(http.StatusOK, gin.H{
		"schedule": gin.H{
			"id":              schedule.ID,
			"week_start_date": schedule.WeekStartDate.Format("2006-01-02"),
			"week_end_date":   schedule.WeekEndDate.Format("2006-01-02"),
			"status":          schedule.Status,
			"approved_at":     schedule.ApprovedAt,
		},
		"student": student,
		"slots":   filteredSlots,
	})
}

// Protected teacher: GET /api/teacher/schedule?week_start=YYYY-MM-DD&teacher_id=&student_id=
func (h *UserStudentHandler) GetTeacherPublishedSchedule(c *gin.Context) {
	role, _ := c.Get("role")
	if role != string(models.RoleTeacher) && !models.IsAdminRole(role.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ только для преподавателей"})
		return
	}

	weekStart := c.Query("week_start")
	if weekStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start обязателен"})
		return
	}

	parsedWeekStart, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start должен быть в формате YYYY-MM-DD"})
		return
	}

	var teacherID uint
	if raw := strings.TrimSpace(c.Query("teacher_id")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID преподавателя"})
			return
		}
		teacherID = uint(parsed)
	}

	var studentID uint
	if raw := strings.TrimSpace(c.Query("student_id")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID ученика"})
			return
		}
		studentID = uint(parsed)
	}

	var schedule models.Schedule
	if err := h.db.Where("week_start_date = ? AND status = ?", parsedWeekStart, models.ScheduleStatusApproved).First(&schedule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Опубликованное расписание на эту неделю не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	var slots []models.ScheduleSlot
	query := h.db.
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("GroupLessonAttendance").
		Preload("GroupLessonAttendance.Student").
		Preload("Teachers.Teacher").
		Where("schedule_id = ? AND status != ?", schedule.ID, models.ScheduleSlotStatusCancelled)

	if teacherID != 0 {
		query = query.Where(`schedule_slots.teacher_id = ? OR EXISTS (
			SELECT 1 FROM schedule_slot_teachers sst
			WHERE sst.schedule_slot_id = schedule_slots.id AND sst.teacher_id = ?
		)`, teacherID, teacherID)
	}

	if err := query.Order("weekday ASC, start_time ASC, id ASC").Find(&slots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения слотов"})
		return
	}

	if studentID != 0 {
		filtered := []models.ScheduleSlot{}
		for _, slot := range slots {
			if slot.SlotType == models.SlotTypeIndividual && slot.StudentID != nil && *slot.StudentID == studentID {
				filtered = append(filtered, slot)
				continue
			}
			if slot.SlotType != models.SlotTypeGroup {
				continue
			}
			if !slotHasPublishedStudent(slot, studentID) {
				continue
			}
			filtered = append(filtered, slot)
		}
		slots = filtered
	}

	c.JSON(http.StatusOK, gin.H{
		"schedule": gin.H{
			"id":              schedule.ID,
			"week_start_date": schedule.WeekStartDate.Format("2006-01-02"),
			"week_end_date":   schedule.WeekEndDate.Format("2006-01-02"),
			"status":          schedule.Status,
			"approved_at":     schedule.ApprovedAt,
		},
		"slots": slots,
	})
}

// slotHasPublishedStudent uses the per-session participant snapshot whenever
// one exists. Older slots keep the template-enrollment fallback; an explicitly
// absent child never sees the group lesson in a personal schedule.
func slotHasPublishedStudent(slot models.ScheduleSlot, studentID uint) bool {
	if len(slot.GroupLessonAttendance) > 0 {
		for _, attendance := range slot.GroupLessonAttendance {
			if attendance.StudentID == studentID {
				return attendance.Attended == nil || *attendance.Attended
			}
		}
		return false
	}
	if slot.GroupLesson == nil {
		return false
	}
	for _, enrollment := range slot.GroupLesson.Enrollments {
		if enrollment.StudentID == studentID {
			return true
		}
	}
	return false
}

func (h *UserStudentHandler) GetTeacherScheduleOptions(c *gin.Context) {
	role, _ := c.Get("role")
	if role != string(models.RoleTeacher) && !models.IsAdminRole(role.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Доступ только для преподавателей"})
		return
	}

	var teachers []models.Teacher
	if err := h.db.Where("is_active = ?", true).Order("full_name ASC").Find(&teachers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения списка преподавателей"})
		return
	}
	// The schedule owner must stay selectable even when their teacher record is
	// paused. Otherwise the client has no name for the linked teacher and falls
	// back to the user's own name instead.
	userID := extractUserID(c)
	if userID != 0 {
		if linkedTeacher, err := findLinkedTeacher(h.db, userID); err == nil {
			found := false
			for _, teacher := range teachers {
				if teacher.ID == linkedTeacher.ID {
					found = true
					break
				}
			}
			if !found {
				teachers = append(teachers, linkedTeacher)
			}
		}
	}

	var students []models.Student
	if err := h.db.Where("is_active = ?", true).Order("full_name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения списка учеников"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teachers": teachers, "students": students})
}

func extractUserID(c *gin.Context) uint {
	v, _ := c.Get("userID")
	switch val := v.(type) {
	case uint:
		return val
	case int:
		return uint(val)
	case int64:
		return uint(val)
	case float64:
		return uint(val)
	}
	return 0
}
