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
	FundingType     string  `json:"funding_type"`
	VisitsPerWeek   int     `json:"visits_per_week" binding:"required"`
	DurationMin     int     `json:"duration_min" binding:"required"`
	Status          string `json:"status"`
}

type UpdateAssignmentRequest struct {
	StudentID     *uint  `json:"student_id"`
	TeacherID     *uint  `json:"teacher_id"`
	SubjectID     *uint  `json:"subject_id"`
	FundingType   string `json:"funding_type"`
	VisitsPerWeek *int   `json:"visits_per_week"`
	DurationMin   *int   `json:"duration_min"`
	Status        string `json:"status"`
}

func isValidAssignmentStatus(value string) bool {
	return value == models.AssignmentStatusActive || value == models.AssignmentStatusPaused
}

func isValidVisitsPerWeek(value int) bool {
	return value >= 1 && value <= 5
}

func isValidPlannedVisits(value int) bool {
	return value >= 0 && value <= 5
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
		Preload("Student.Availability").
		Preload("Teacher").
		Preload("Teacher.Rooms").
		Preload("Teacher.Rooms.Room").
		Preload("Teacher.Availability").
		Preload("Subject").
		Order("id ASC")

	if teacherID := c.Query("teacher_id"); teacherID != "" {
		id, err := strconv.Atoi(teacherID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
			return
		}
		query = query.Where("teacher_id = ?", id)
	}

	if studentID := c.Query("student_id"); studentID != "" {
		id, err := strconv.Atoi(studentID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
			return
		}
		query = query.Where("student_id = ?", id)
	}

	if subjectID := c.Query("subject_id"); subjectID != "" {
		id, err := strconv.Atoi(subjectID)
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
			return
		}
		query = query.Where("subject_id = ?", id)
	}

	if status := c.Query("status"); status != "" {
		if !isValidAssignmentStatus(status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный статус"})
			return
		}
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"assignments": assignments})
}

func (h *AssignmentHandler) GetAssignmentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var assignment models.Assignment
	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"assignment": assignment})
}

func (h *AssignmentHandler) GetTeacherAssignments(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, teacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ученика, преподавателя и предмета должны быть положительными числами"})
		return
	}

	if !isValidVisitsPerWeek(req.VisitsPerWeek) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Количество занятий в неделю должно быть от 1 до 5"})
		return
	}

	if !isValidDurationMin(req.DurationMin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Длительность занятия должна быть 30 или 50 минут"})
		return
	}

	status := models.AssignmentStatusActive
	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Статус должен быть active или paused"})
			return
		}
		status = req.Status
	}

	fundingType := models.FundingTypeBudget
	if strings.TrimSpace(req.FundingType) != "" {
		if !isValidFundingType(req.FundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Тип финансирования должен быть paid или budget"})
			return
		}
		fundingType = req.FundingType
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки ученика"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, req.TeacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки преподавателя"})
		return
	}

	var subject models.Subject
	if err := h.db.First(&subject, req.SubjectID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Предмет не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки предмета"})
		return
	}

	var teacherSubject models.TeacherSubject
	if err := h.db.Where("teacher_id = ? AND subject_id = ?", req.TeacherID, req.SubjectID).
		First(&teacherSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Этот преподаватель не ведёт указанный предмет"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Этот преподаватель не ведёт указанный предмет"})
		return
	}

	var existing models.Assignment
	if err := h.db.Where(
		"student_id = ? AND teacher_id = ? AND subject_id = ?",
		req.StudentID,
		req.TeacherID,
		req.SubjectID,
	).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Запись с такими данными уже существует"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	assignment := models.Assignment{
		StudentID:     req.StudentID,
		TeacherID:     req.TeacherID,
		SubjectID:     req.SubjectID,
		FundingType:   fundingType,
		VisitsPerWeek: req.VisitsPerWeek,
		DurationMin:   req.DurationMin,
		Status:        status,
	}

	if err := h.db.Create(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, assignment.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	newStudentID := assignment.StudentID
	newTeacherID := assignment.TeacherID
	newSubjectID := assignment.SubjectID

	if req.StudentID != nil {
		if *req.StudentID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID ученика должен быть положительным числом"})
			return
		}
		newStudentID = *req.StudentID
	}

	if req.TeacherID != nil {
		if *req.TeacherID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID преподавателя должен быть положительным числом"})
			return
		}
		newTeacherID = *req.TeacherID
	}

	if req.SubjectID != nil {
		if *req.SubjectID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID предмета должен быть положительным числом"})
			return
		}
		newSubjectID = *req.SubjectID
	}

	if strings.TrimSpace(req.FundingType) != "" {
		if !isValidFundingType(req.FundingType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Тип финансирования должен быть paid или budget"})
			return
		}
		assignment.FundingType = req.FundingType
	}

	if req.VisitsPerWeek != nil {
		if !isValidVisitsPerWeek(*req.VisitsPerWeek) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Количество занятий в неделю должно быть от 1 до 5"})
			return
		}
		assignment.VisitsPerWeek = *req.VisitsPerWeek
	}

	if req.DurationMin != nil {
		if !isValidDurationMin(*req.DurationMin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Длительность занятия должна быть 30 или 50 минут"})
			return
		}
		assignment.DurationMin = *req.DurationMin
	}

	if strings.TrimSpace(req.Status) != "" {
		if !isValidAssignmentStatus(req.Status) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Статус должен быть active или paused"})
			return
		}
		assignment.Status = req.Status
	}

	if newStudentID != assignment.StudentID {
		var student models.Student
		if err := h.db.First(&student, newStudentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ученик не найден"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки ученика"})
			return
		}
		assignment.StudentID = newStudentID
	}

	if newTeacherID != assignment.TeacherID {
		var teacher models.Teacher
		if err := h.db.First(&teacher, newTeacherID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Преподаватель не найден"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки преподавателя"})
			return
		}
		assignment.TeacherID = newTeacherID
	}

	if newSubjectID != assignment.SubjectID {
		var subject models.Subject
		if err := h.db.First(&subject, newSubjectID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Предмет не найден"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки предмета"})
			return
		}
		assignment.SubjectID = newSubjectID
	}

	var teacherSubject models.TeacherSubject
	if err := h.db.Where("teacher_id = ? AND subject_id = ?", assignment.TeacherID, assignment.SubjectID).
		First(&teacherSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Этот преподаватель не ведёт указанный предмет"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Этот преподаватель не ведёт указанный предмет"})
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
		c.JSON(http.StatusConflict, gin.H{"error": "Запись с такими данными уже существует"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	if err := h.db.Save(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		First(&assignment, assignment.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var assignment models.Assignment
	if err := h.db.First(&assignment, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if assignment.Status == models.AssignmentStatusPaused {
		err := h.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("assignment_id = ?", assignment.ID).Delete(&models.ScheduleSlot{}).Error; err != nil {
				return err
			}
			if err := tx.Where("assignment_id = ?", assignment.ID).Delete(&models.ScheduleGenerationIssue{}).Error; err != nil {
				return err
			}
			return tx.Delete(&assignment).Error
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Assignment deleted successfully",
		})
		return
	}

	if err := h.db.Delete(&assignment).Error; err != nil {
		if strings.Contains(err.Error(), "23503") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить назначение: есть связанные слоты расписания. Сначала удалите их или сбросьте расписание."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Assignment deleted successfully",
	})
}

