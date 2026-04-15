package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AssignmentHandler struct {
	db *gorm.DB
}

func NewAssignmentHandler(db *gorm.DB) *AssignmentHandler {
	return &AssignmentHandler{db: db}
}

type CreateAssignmentRequest struct {
	StudentID       uint    `json:"student_id" binding:"required"`
	TeacherID       uint    `json:"teacher_id" binding:"required"`
	SubjectID       uint    `json:"subject_id" binding:"required"`
	VisitsPerWeek   int     `json:"visits_per_week" binding:"required"`
	DurationMin     int     `json:"duration_min" binding:"required"`
	Status          string  `json:"status"`
	AllowSubstitute *bool   `json:"allow_substitute"`
	Notes           *string `json:"notes"`
}

type UpdateAssignmentRequest struct {
	StudentID       *uint   `json:"student_id"`
	TeacherID       *uint   `json:"teacher_id"`
	SubjectID       *uint   `json:"subject_id"`
	VisitsPerWeek   *int    `json:"visits_per_week"`
	DurationMin     *int    `json:"duration_min"`
	Status          string  `json:"status"`
	AllowSubstitute *bool   `json:"allow_substitute"`
	Notes           *string `json:"notes"`
}

type CreateAssignmentWeekOverrideRequest struct {
	WeekStartDate string  `json:"week_start_date" binding:"required"`
	PlannedVisits int     `json:"planned_visits" binding:"required"`
	DurationMin   *int    `json:"duration_min"`
	Status        string  `json:"status"`
	Notes         *string `json:"notes"`
}

type UpdateAssignmentWeekOverrideRequest struct {
	WeekStartDate string  `json:"week_start_date"`
	PlannedVisits *int    `json:"planned_visits"`
	DurationMin   *int    `json:"duration_min"`
	Status        string  `json:"status"`
	Notes         *string `json:"notes"`
}

func isValidAssignmentStatus(value string) bool {
	return value == models.AssignmentStatusActive || value == models.AssignmentStatusPaused
}

func isValidVisitsPerWeek(value int) bool {
	return value >= 1 && value <= 3
}

func isValidPlannedVisits(value int) bool {
	return value >= 0 && value <= 3
}

func isValidDurationMin(value int) bool {
	return value == 30 || value == 50
}

func parseWeekStartDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", value)
}

func (h *AssignmentHandler) GetAssignments(c *gin.Context) {
	var assignments []models.Assignment

	query := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Order("id ASC")

	if teacherID := c.Query("teacher_id"); teacherID != "" {
		id, err := strconv.Atoi(teacherID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher_id"})
			return
		}
		query = query.Where("teacher_id = ?", id)
	}

	if studentID := c.Query("student_id"); studentID != "" {
		id, err := strconv.Atoi(studentID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student_id"})
			return
		}
		query = query.Where("student_id = ?", id)
	}

	if subjectID := c.Query("subject_id"); subjectID != "" {
		id, err := strconv.Atoi(subjectID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subject_id"})
			return
		}
		query = query.Where("subject_id = ?", id)
	}

	if status := c.Query("status"); status != "" {
		if !isValidAssignmentStatus(status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"assignments": assignments})
}

func (h *AssignmentHandler) GetAssignmentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	var assignment models.Assignment
	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"assignment": assignment})
}

func (h *AssignmentHandler) GetTeacherAssignments(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, teacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
		return
	}

	var assignments []models.Assignment
	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Where("teacher_id = ?", teacherID).
		Order("id ASC").
		Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher assignments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teacher_id":   teacher.ID,
		"teacher_name": teacher.FullName,
		"assignments":  assignments,
	})
}

func (h *AssignmentHandler) CreateAssignment(c *gin.Context) {
	var req CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.StudentID == 0 || req.TeacherID == 0 || req.SubjectID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "student_id, teacher_id and subject_id must be positive"})
		return
	}

	if !isValidVisitsPerWeek(req.VisitsPerWeek) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visits_per_week must be between 1 and 3"})
		return
	}

	if !isValidDurationMin(req.DurationMin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duration_min must be 30 or 50"})
		return
	}

	status := models.AssignmentStatusActive
	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'active' or 'paused'"})
			return
		}
		status = req.Status
	}

	allowSubstitute := false
	if req.AllowSubstitute != nil {
		allowSubstitute = *req.AllowSubstitute
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate student"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, req.TeacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate teacher"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, req.SubjectID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Subject not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate subject"})
		return
	}

	var teacherSubject models.TeacherSubject
	if err := h.db.Where("teacher_id = ? AND subject_id = ?", req.TeacherID, req.SubjectID).
		First(&teacherSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Teacher does not teach this subject"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate teacher subject relation"})
		return
	}

	var existing models.Assignment
	if err := h.db.Where(
		"student_id = ? AND teacher_id = ? AND subject_id = ?",
		req.StudentID,
		req.TeacherID,
		req.SubjectID,
	).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Assignment already exists"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check assignment uniqueness"})
		return
	}

	assignment := models.Assignment{
		StudentID:       req.StudentID,
		TeacherID:       req.TeacherID,
		SubjectID:       req.SubjectID,
		VisitsPerWeek:   req.VisitsPerWeek,
		DurationMin:     req.DurationMin,
		Status:          status,
		AllowSubstitute: allowSubstitute,
		Notes:           normalizeOptionalString(req.Notes),
	}

	if err := h.db.Create(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assignment"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, assignment.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created assignment"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Assignment created successfully",
		"assignment": assignment,
	})
}

func (h *AssignmentHandler) UpdateAssignment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	var req UpdateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var assignment models.Assignment
	if err := h.db.First(&assignment, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment"})
		return
	}

	newStudentID := assignment.StudentID
	newTeacherID := assignment.TeacherID
	newSubjectID := assignment.SubjectID

	if req.StudentID != nil {
		if *req.StudentID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "student_id must be positive"})
			return
		}
		newStudentID = *req.StudentID
	}

	if req.TeacherID != nil {
		if *req.TeacherID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "teacher_id must be positive"})
			return
		}
		newTeacherID = *req.TeacherID
	}

	if req.SubjectID != nil {
		if *req.SubjectID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subject_id must be positive"})
			return
		}
		newSubjectID = *req.SubjectID
	}

	if req.VisitsPerWeek != nil {
		if !isValidVisitsPerWeek(*req.VisitsPerWeek) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "visits_per_week must be between 1 and 3"})
			return
		}
		assignment.VisitsPerWeek = *req.VisitsPerWeek
	}

	if req.DurationMin != nil {
		if !isValidDurationMin(*req.DurationMin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "duration_min must be 30 or 50"})
			return
		}
		assignment.DurationMin = *req.DurationMin
	}

	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'active' or 'paused'"})
			return
		}
		assignment.Status = req.Status
	}

	if req.AllowSubstitute != nil {
		assignment.AllowSubstitute = *req.AllowSubstitute
	}

	if req.Notes != nil {
		assignment.Notes = normalizeOptionalString(req.Notes)
	}

	if newStudentID != assignment.StudentID {
		var student models.Student
		if err := h.db.First(&student, newStudentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Student not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate student"})
			return
		}
		assignment.StudentID = newStudentID
	}

	if newTeacherID != assignment.TeacherID {
		var teacher models.Teacher
		if err := h.db.First(&teacher, newTeacherID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Teacher not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate teacher"})
			return
		}
		assignment.TeacherID = newTeacherID
	}

	if newSubjectID != assignment.SubjectID {
		var subject models.Subject
		if err := h.db.First(&subject, newSubjectID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Subject not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate subject"})
			return
		}
		assignment.SubjectID = newSubjectID
	}

	var teacherSubject models.TeacherSubject
	if err := h.db.Where("teacher_id = ? AND subject_id = ?", assignment.TeacherID, assignment.SubjectID).
		First(&teacherSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Teacher does not teach this subject"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate teacher subject relation"})
		return
	}

	var existing models.Assignment
	if err := h.db.Where(
		"student_id = ? AND teacher_id = ? AND subject_id = ? AND id <> ?",
		assignment.StudentID,
		assignment.TeacherID,
		assignment.SubjectID,
		assignment.ID,
	).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Assignment already exists"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check assignment uniqueness"})
		return
	}

	if err := h.db.Save(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, assignment.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Assignment updated successfully",
		"assignment": assignment,
	})
}

func (h *AssignmentHandler) DeleteAssignment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	var assignment models.Assignment
	if err := h.db.First(&assignment, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment"})
		return
	}

	if err := h.db.Delete(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Assignment deleted successfully",
	})
}

func (h *AssignmentHandler) GetAssignmentWeekOverrides(c *gin.Context) {
	weekStart := strings.TrimSpace(c.Query("week_start"))
	if weekStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start query param is required"})
		return
	}

	parsedWeekStart, err := parseWeekStartDate(weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start must be in YYYY-MM-DD format"})
		return
	}

	var overrides []models.AssignmentWeekOverride
	if err := h.db.
		Preload("Assignment").
		Preload("Assignment.Student").
		Preload("Assignment.Teacher").
		Preload("Assignment.Subject").
		Where("week_start_date = ?", parsedWeekStart).
		Order("id ASC").
		Find(&overrides).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment week overrides"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"week_start_date": weekStart,
		"overrides":       overrides,
	})
}

func (h *AssignmentHandler) CreateAssignmentWeekOverride(c *gin.Context) {
	assignmentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || assignmentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	var req CreateAssignmentWeekOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var assignment models.Assignment
	if err := h.db.First(&assignment, assignmentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment"})
		return
	}

	parsedWeekStart, err := parseWeekStartDate(req.WeekStartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start_date must be in YYYY-MM-DD format"})
		return
	}

	if !isValidPlannedVisits(req.PlannedVisits) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "planned_visits must be between 0 and 3"})
		return
	}

	if req.DurationMin != nil && !isValidDurationMin(*req.DurationMin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duration_min must be 30 or 50"})
		return
	}

	status := models.AssignmentStatusActive
	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'active' or 'paused'"})
			return
		}
		status = req.Status
	}

	var existing models.AssignmentWeekOverride
	if err := h.db.Where("assignment_id = ? AND week_start_date = ?", assignmentID, parsedWeekStart).
		First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Week override already exists for this assignment and week"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check week override uniqueness"})
		return
	}

	override := models.AssignmentWeekOverride{
		AssignmentID:  uint(assignmentID),
		WeekStartDate: parsedWeekStart,
		PlannedVisits: req.PlannedVisits,
		DurationMin:   req.DurationMin,
		Status:        status,
		Notes:         normalizeOptionalString(req.Notes),
	}

	if err := h.db.Create(&override).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assignment week override"})
		return
	}

	if err := h.db.
		Preload("Assignment").
		First(&override, override.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created week override"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Assignment week override created successfully",
		"override": override,
	})
}

func (h *AssignmentHandler) UpdateAssignmentWeekOverride(c *gin.Context) {
	assignmentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || assignmentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	overrideID, err := strconv.Atoi(c.Param("overrideId"))
	if err != nil || overrideID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid override id"})
		return
	}

	var req UpdateAssignmentWeekOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var override models.AssignmentWeekOverride
	if err := h.db.Where("id = ? AND assignment_id = ?", overrideID, assignmentID).
		First(&override).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment week override not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment week override"})
		return
	}

	if strings.TrimSpace(req.WeekStartDate) != "" {
		parsedWeekStart, err := parseWeekStartDate(req.WeekStartDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "week_start_date must be in YYYY-MM-DD format"})
			return
		}
		override.WeekStartDate = parsedWeekStart
	}

	if req.PlannedVisits != nil {
		if !isValidPlannedVisits(*req.PlannedVisits) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "planned_visits must be between 0 and 3"})
			return
		}
		override.PlannedVisits = *req.PlannedVisits
	}

	if req.DurationMin != nil {
		if !isValidDurationMin(*req.DurationMin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "duration_min must be 30 or 50"})
			return
		}
		override.DurationMin = req.DurationMin
	}

	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'active' or 'paused'"})
			return
		}
		override.Status = req.Status
	}

	if req.Notes != nil {
		override.Notes = normalizeOptionalString(req.Notes)
	}

	var existing models.AssignmentWeekOverride
	if err := h.db.Where(
		"assignment_id = ? AND week_start_date = ? AND id <> ?",
		assignmentID,
		override.WeekStartDate,
		override.ID,
	).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Week override already exists for this assignment and week"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check week override uniqueness"})
		return
	}

	if err := h.db.Save(&override).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment week override"})
		return
	}

	if err := h.db.
		Preload("Assignment").
		First(&override, override.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated week override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Assignment week override updated successfully",
		"override": override,
	})
}

func (h *AssignmentHandler) DeleteAssignmentWeekOverride(c *gin.Context) {
	assignmentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || assignmentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment id"})
		return
	}

	overrideID, err := strconv.Atoi(c.Param("overrideId"))
	if err != nil || overrideID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid override id"})
		return
	}

	var override models.AssignmentWeekOverride
	if err := h.db.Where("id = ? AND assignment_id = ?", overrideID, assignmentID).
		First(&override).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment week override not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment week override"})
		return
	}

	if err := h.db.Delete(&override).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete assignment week override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Assignment week override deleted successfully",
	})
}
