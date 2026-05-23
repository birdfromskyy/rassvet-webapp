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

type StudentHandler struct {
	db *gorm.DB
}

func NewStudentHandler(db *gorm.DB) *StudentHandler {
	return &StudentHandler{db: db}
}

type CreateStudentRequest struct {
	FullName    string `json:"full_name" binding:"required"`
	FundingType string `json:"funding_type"`
	IsActive    *bool  `json:"is_active"`
}

type UpdateStudentRequest struct {
	FullName    string `json:"full_name"`
	FundingType string `json:"funding_type"`
	IsActive    *bool  `json:"is_active"`
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
	return weekday >= 1 && weekday <= 7
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

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", value)
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное значение параметра is_active"})
			return
		}
	}

	if fundingType := c.Query("funding_type"); fundingType != "" {
		if !isValidFundingType(fundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный тип финансирования"})
			return
		}
		query = query.Where("funding_type = ?", fundingType)
	}

	if err := query.Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"students": students})
}

func (h *StudentHandler) GetStudentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле «ФИО» обязательно"})
		return
	}

	if req.FundingType != "" && !isValidFundingType(req.FundingType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Тип финансирования должен быть paid или budget"})
		return
	}
	if req.FundingType == "" {
		req.FundingType = models.FundingTypeBudget
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	student := models.Student{
		FullName:    req.FullName,
		FundingType: req.FundingType,
		IsActive:    isActive,
	}

	if err := h.db.Select("FullName", "FundingType", "IsActive").Create(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать ученика"})
		return
	}

	if !isActive {
		if err := h.db.Model(&student).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать ученика"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if req.FullName != "" {
		req.FullName = strings.TrimSpace(req.FullName)
		if req.FullName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ФИО не может быть пустым"})
			return
		}
		student.FullName = req.FullName
	}

	if req.FundingType != "" {
		if !isValidFundingType(req.FundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Тип финансирования должен быть paid или budget"})
			return
		}
		student.FundingType = req.FundingType
	}

	if req.IsActive != nil {
		student.IsActive = *req.IsActive
	}

	if err := h.db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить ученика"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	student.IsActive = false

	if err := h.db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if !student.IsActive {
		var activeAssignments int64
		if err := h.db.Model(&models.Assignment{}).
			Where("student_id = ? AND status = ?", student.ID, models.AssignmentStatusActive).
			Count(&activeAssignments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
			return
		}
		if activeAssignments > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить ученика: есть активные назначения. Сначала поставьте их на паузу."})
			return
		}

		err := h.db.Transaction(func(tx *gorm.DB) error {
			slotIDs := tx.Model(&models.ScheduleSlot{}).Select("id").Where("student_id = ?", student.ID)
			if err := tx.Where("schedule_slot_id IN (?) OR student_id = ?", slotIDs, student.ID).Delete(&models.ScheduleSlotExclusion{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.ScheduleSlot{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.ScheduleGenerationIssue{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.StudentAvailability{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.UserStudent{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.GroupLessonEnrollment{}).Error; err != nil {
				return err
			}
			assignmentIDs := tx.Model(&models.Assignment{}).Select("id").Where("student_id = ?", student.ID)
			if err := tx.Where("assignment_id IN (?)", assignmentIDs).Delete(&models.AssignmentWeekOverride{}).Error; err != nil {
				return err
			}
			if err := tx.Where("student_id = ?", student.ID).Delete(&models.Assignment{}).Error; err != nil {
				return err
			}
			return tx.Delete(&student).Error
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
		return
	}

	if err := h.db.Delete(&student).Error; err != nil {
		if strings.Contains(err.Error(), "23503") || strings.Contains(err.Error(), "foreign key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить ученика: есть связанные назначения или слоты. Сначала деактивируйте."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить ученика"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
}

func (h *StudentHandler) GetStudentAvailability(c *gin.Context) {
	studentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	var availability []models.StudentAvailability
	if err := h.db.Where("student_id = ?", studentID).
		Order("weekday ASC, start_time ASC").
		Find(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if !isValidWeekday(req.Weekday) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "День недели должен быть от 1 до 7"})
		return
	}

	if !isValidTimeHHMM(req.StartTime) || !isValidTimeHHMM(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала и окончания должно быть в формате ЧЧ:ММ"})
		return
	}

	if !isStartBeforeEnd(req.StartTime, req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала должно быть раньше времени окончания"})
		return
	}

	availability := models.StudentAvailability{
		StudentID: uint(studentID),
		Weekday:   req.Weekday,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
	}

	if err := h.db.Create(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Окно доступности ученика не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if req.Weekday != nil {
		if !isValidWeekday(*req.Weekday) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "День недели должен быть от 1 до 7"})
			return
		}
		availability.Weekday = *req.Weekday
	}

	if req.StartTime != "" {
		if !isValidTimeHHMM(req.StartTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала должно быть в формате ЧЧ:ММ"})
			return
		}
		availability.StartTime = req.StartTime
	}

	if req.EndTime != "" {
		if !isValidTimeHHMM(req.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Время окончания должно быть в формате ЧЧ:ММ"})
			return
		}
		availability.EndTime = req.EndTime
	}

	if !isStartBeforeEnd(availability.StartTime, availability.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала должно быть раньше времени окончания"})
		return
	}

	if err := h.db.Save(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var availability models.StudentAvailability
	if err := h.db.Where("id = ? AND student_id = ?", availabilityID, studentID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Окно доступности ученика не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if err := h.db.Delete(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Student availability deleted successfully",
	})
}
