package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type StudentHandler struct {
	db *gorm.DB
}

func NewStudentHandler(db *gorm.DB) *StudentHandler {
	return &StudentHandler{db: db}
}

type CreateStudentRequest struct {
	FullName    string  `json:"full_name" binding:"required"`
	ParentPhone *string `json:"parent_phone"`
	FundingType string  `json:"funding_type" binding:"required"`
	IsActive    *bool   `json:"is_active"`
	Notes       *string `json:"notes"`
}

type UpdateStudentRequest struct {
	FullName    string  `json:"full_name"`
	ParentPhone *string `json:"parent_phone"`
	FundingType string  `json:"funding_type"`
	IsActive    *bool   `json:"is_active"`
	Notes       *string `json:"notes"`
}

type CreateStudentAvailabilityRequest struct {
	Weekday   int    `json:"weekday" binding:"required"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}

type UpdateStudentAvailabilityRequest struct {
	Weekday   *int   `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func isValidFundingType(value string) bool {
	return value == models.FundingTypePaid || value == models.FundingTypeBudget
}

func isValidWeekday(weekday int) bool {
	return weekday >= 1 && weekday <= 6
}

func isValidTimeHHMM(value string) bool {
	if len(value) != 5 {
		return false
	}
	if value[2] != ':' {
		return false
	}

	hours, err := strconv.Atoi(value[:2])
	if err != nil {
		return false
	}

	minutes, err := strconv.Atoi(value[3:])
	if err != nil {
		return false
	}

	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

func isStartBeforeEnd(start, end string) bool {
	return start < end
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func (h *StudentHandler) GetStudents(c *gin.Context) {
	var students []models.Student

	query := h.db.Order("id ASC")

	if isActive := c.Query("is_active"); isActive != "" {
		switch strings.ToLower(isActive) {
		case "true":
			query = query.Where("is_active = ?", true)
		case "false":
			query = query.Where("is_active = ?", false)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid is_active value"})
			return
		}
	}

	if fundingType := c.Query("funding_type"); fundingType != "" {
		if !isValidFundingType(fundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid funding_type value"})
			return
		}
		query = query.Where("funding_type = ?", fundingType)
	}

	if err := query.Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch students"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"students": students})
}

func (h *StudentHandler) GetStudentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"student": student})
}

func (h *StudentHandler) CreateStudent(c *gin.Context) {
	var req CreateStudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "full_name is required"})
		return
	}

	if !isValidFundingType(req.FundingType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "funding_type must be 'paid' or 'budget'"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	student := models.Student{
		FullName:    req.FullName,
		ParentPhone: normalizeOptionalString(req.ParentPhone),
		FundingType: req.FundingType,
		IsActive:    isActive,
		Notes:       normalizeOptionalString(req.Notes),
	}

	if err := h.db.Select("FullName", "ParentPhone", "FundingType", "IsActive", "Notes").Create(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create student"})
		return
	}

	if !isActive {
		if err := h.db.Model(&student).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create student"})
			return
		}
		student.IsActive = false
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Student created successfully",
		"student": student,
	})
}

func (h *StudentHandler) UpdateStudent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var req UpdateStudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	if req.FullName != "" {
		req.FullName = strings.TrimSpace(req.FullName)
		if req.FullName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "full_name cannot be empty"})
			return
		}
		student.FullName = req.FullName
	}

	if req.FundingType != "" {
		if !isValidFundingType(req.FundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "funding_type must be 'paid' or 'budget'"})
			return
		}
		student.FundingType = req.FundingType
	}

	if req.IsActive != nil {
		student.IsActive = *req.IsActive
	}

	if req.ParentPhone != nil {
		student.ParentPhone = normalizeOptionalString(req.ParentPhone)
	}

	if req.Notes != nil {
		student.Notes = normalizeOptionalString(req.Notes)
	}

	if err := h.db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update student"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Student updated successfully",
		"student": student,
	})
}

func (h *StudentHandler) DeactivateStudent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	student.IsActive = false

	if err := h.db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate student"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Student deactivated successfully",
		"student": student,
	})
}

func (h *StudentHandler) DeleteStudent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	if err := h.db.Delete(&student).Error; err != nil {
		if strings.Contains(err.Error(), "23503") || strings.Contains(err.Error(), "foreign key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить ученика: есть связанные назначения или слоты. Сначала деактивируйте."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete student"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
}

func (h *StudentHandler) GetStudentAvailability(c *gin.Context) {
	studentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	var availability []models.StudentAvailability
	if err := h.db.Where("student_id = ?", studentID).
		Order("weekday ASC, start_time ASC").
		Find(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student availability"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"student_id":   student.ID,
		"student_name": student.FullName,
		"availability": availability,
	})
}

func (h *StudentHandler) CreateStudentAvailability(c *gin.Context) {
	studentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var req CreateStudentAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student"})
		return
	}

	if !isValidWeekday(req.Weekday) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "weekday must be between 1 and 6"})
		return
	}

	if !isValidTimeHHMM(req.StartTime) || !isValidTimeHHMM(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_time and end_time must be in HH:MM format"})
		return
	}

	if !isStartBeforeEnd(req.StartTime, req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be earlier than end_time"})
		return
	}

	availability := models.StudentAvailability{
		StudentID: uint(studentID),
		Weekday:   req.Weekday,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
	}

	if err := h.db.Create(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create student availability"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Student availability created successfully",
		"availability": availability,
	})
}

func (h *StudentHandler) UpdateStudentAvailability(c *gin.Context) {
	studentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid availability id"})
		return
	}

	var req UpdateStudentAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var availability models.StudentAvailability
	if err := h.db.Where("id = ? AND student_id = ?", availabilityID, studentID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student availability not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student availability"})
		return
	}

	if req.Weekday != nil {
		if !isValidWeekday(*req.Weekday) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "weekday must be between 1 and 6"})
			return
		}
		availability.Weekday = *req.Weekday
	}

	if req.StartTime != "" {
		if !isValidTimeHHMM(req.StartTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be in HH:MM format"})
			return
		}
		availability.StartTime = req.StartTime
	}

	if req.EndTime != "" {
		if !isValidTimeHHMM(req.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "end_time must be in HH:MM format"})
			return
		}
		availability.EndTime = req.EndTime
	}

	if !isStartBeforeEnd(availability.StartTime, availability.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be earlier than end_time"})
		return
	}

	if err := h.db.Save(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update student availability"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Student availability updated successfully",
		"availability": availability,
	})
}

func (h *StudentHandler) DeleteStudentAvailability(c *gin.Context) {
	studentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid availability id"})
		return
	}

	var availability models.StudentAvailability
	if err := h.db.Where("id = ? AND student_id = ?", availabilityID, studentID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Student availability not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch student availability"})
		return
	}

	if err := h.db.Delete(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete student availability"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Student availability deleted successfully",
	})
}
