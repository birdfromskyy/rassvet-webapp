package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserStudentHandler struct {
	db *gorm.DB
}

func NewUserStudentHandler(db *gorm.DB) *UserStudentHandler {
	return &UserStudentHandler{db: db}
}

// Admin: GET /api/admin/users
func (h *UserStudentHandler) GetUsers(c *gin.Context) {
	var users []models.User
	if err := h.db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	role := req.Role
	if role != "admin" && role != "user" {
		role = "user"
	}

	isVerified := true
	user := models.User{
		Email:      req.Email,
		Password:   string(hashedPassword),
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		MiddleName: req.MiddleName,
		Role:       models.UserRole(role),
		IsVerified: isVerified,
	}

	if err := h.db.Select("Email", "Password", "FirstName", "LastName", "MiddleName", "Role", "IsVerified").Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Пользователь с таким email уже существует"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
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

	role := req.Role
	if role != "admin" && role != "user" {
		role = string(user.Role)
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// Admin: GET /api/admin/users/:id/children
func (h *UserStudentHandler) GetUserChildren(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	var links []models.UserStudent
	if err := h.db.Where("user_id = ?", userID).Preload("Student").Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch children"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	var req AddChildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add child"})
		return
	}

	h.db.Preload("Student").First(&link, link.ID)
	c.JSON(http.StatusCreated, gin.H{"link": link})
}

// Admin: DELETE /api/admin/users/:id/children/:studentId
func (h *UserStudentHandler) RemoveUserChild(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	result := h.db.Where("user_id = ? AND student_id = ?", userID, studentID).Delete(&models.UserStudent{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove child"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Link not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Child removed successfully"})
}

// Protected: GET /api/my-children
func (h *UserStudentHandler) GetMyChildren(c *gin.Context) {
	userID := extractUserID(c)

	var links []models.UserStudent
	if err := h.db.Where("user_id = ?", userID).Preload("Student").Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch children"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"children": links})
}

// Protected: GET /api/my-children/:studentId/schedule?week_start=YYYY-MM-DD
func (h *UserStudentHandler) GetChildSchedule(c *gin.Context) {
	userID := extractUserID(c)

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start query param is required"})
		return
	}

	parsedWeekStart, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start must be in YYYY-MM-DD format"})
		return
	}

	// Only approved schedules are visible to parents
	var schedule models.Schedule
	if err := h.db.Where("week_start_date = ? AND status = ?", parsedWeekStart, models.ScheduleStatusApproved).First(&schedule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Опубликованное расписание на эту неделю не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
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
		Preload("Exclusions").
		Where("schedule_id = ? AND status != ?", schedule.ID, models.ScheduleSlotStatusCancelled).
		Order("weekday ASC, start_time ASC").
		Find(&allSlots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch slots"})
		return
	}

	// Filter slots relevant to this student
	filteredSlots := []models.ScheduleSlot{}
	for _, slot := range allSlots {
		if slot.SlotType == models.SlotTypeIndividual && slot.StudentID != nil && *slot.StudentID == uint(studentID) {
			filteredSlots = append(filteredSlots, slot)
		} else if slot.SlotType == models.SlotTypeGroup && slot.GroupLesson != nil {
			enrolled := false
			for _, e := range slot.GroupLesson.Enrollments {
				if e.StudentID == uint(studentID) {
					enrolled = true
					break
				}
			}
			if enrolled {
				excluded := false
				for _, ex := range slot.Exclusions {
					if ex.StudentID == uint(studentID) {
						excluded = true
						break
					}
				}
				if !excluded {
					filteredSlots = append(filteredSlots, slot)
				}
			}
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
