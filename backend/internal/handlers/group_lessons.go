package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type GroupLessonHandler struct {
	db *gorm.DB
}

func NewGroupLessonHandler(db *gorm.DB) *GroupLessonHandler {
	return &GroupLessonHandler{db: db}
}

type CreateGroupLessonRequest struct {
	Name             string  `json:"name" binding:"required"`
	SubjectID        *uint   `json:"subject_id"`
	DefaultTeacherID *uint   `json:"default_teacher_id"`
	RoomName         string  `json:"room_name"`
	VisitsPerWeek    int     `json:"visits_per_week" binding:"required"`
	DurationMin      int     `json:"duration_min" binding:"required"`
	MaxStudents      int     `json:"max_students"`
	Status           string  `json:"status"`
	Notes            *string `json:"notes"`
}

type UpdateGroupLessonRequest struct {
	Name             string  `json:"name"`
	SubjectID        *uint   `json:"subject_id"`
	DefaultTeacherID *uint   `json:"default_teacher_id"`
	RoomName         *string `json:"room_name"`
	VisitsPerWeek    *int    `json:"visits_per_week"`
	DurationMin      *int    `json:"duration_min"`
	MaxStudents      *int    `json:"max_students"`
	Status           string  `json:"status"`
	Notes            *string `json:"notes"`
}

type CreateGroupLessonWeekOverrideRequest struct {
	WeekStartDate string  `json:"week_start_date" binding:"required"`
	TeacherID     *uint   `json:"teacher_id"`
	PlannedVisits *int    `json:"planned_visits"`
	DurationMin   *int    `json:"duration_min"`
	Status        string  `json:"status"`
	Notes         *string `json:"notes"`
}

func (h *GroupLessonHandler) GetGroupLessons(c *gin.Context) {
	var lessons []models.GroupLesson

	query := h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Enrollments.Student").Order("id ASC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&lessons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить список групп"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"group_lessons": lessons})
}

func (h *GroupLessonHandler) GetGroupLessonByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Enrollments.Student").First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"group_lesson": lesson})
}

func (h *GroupLessonHandler) CreateGroupLesson(c *gin.Context) {
	var req CreateGroupLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.VisitsPerWeek <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visits_per_week должен быть больше 0"})
		return
	}
	if req.DurationMin <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duration_min должен быть больше 0"})
		return
	}

	maxStudents := req.MaxStudents
	if maxStudents <= 0 {
		maxStudents = 10
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = models.GroupLessonStatusActive
	}

	lesson := models.GroupLesson{
		Name:             req.Name,
		SubjectID:        req.SubjectID,
		DefaultTeacherID: req.DefaultTeacherID,
		RoomName:         strings.TrimSpace(req.RoomName),
		VisitsPerWeek:    req.VisitsPerWeek,
		DurationMin:      req.DurationMin,
		MaxStudents:      maxStudents,
		Status:           status,
		Notes:            req.Notes,
	}

	if err := h.db.Create(&lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать группу"})
		return
	}

	h.db.Preload("Subject").Preload("DefaultTeacher").First(&lesson, lesson.ID)

	c.JSON(http.StatusCreated, gin.H{"message": "Группа создана", "group_lesson": lesson})
}

func (h *GroupLessonHandler) UpdateGroupLesson(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}

	var req UpdateGroupLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) != "" {
		lesson.Name = req.Name
	}
	lesson.SubjectID = req.SubjectID
	if req.DefaultTeacherID != nil {
		lesson.DefaultTeacherID = req.DefaultTeacherID
	}
	if req.RoomName != nil {
		lesson.RoomName = strings.TrimSpace(*req.RoomName)
	}
	if req.VisitsPerWeek != nil {
		lesson.VisitsPerWeek = *req.VisitsPerWeek
	}
	if req.DurationMin != nil {
		lesson.DurationMin = *req.DurationMin
	}
	if req.MaxStudents != nil {
		lesson.MaxStudents = *req.MaxStudents
	}
	if strings.TrimSpace(req.Status) != "" {
		lesson.Status = req.Status
	}
	if req.Notes != nil {
		lesson.Notes = req.Notes
	}

	if err := h.db.Save(&lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить группу"})
		return
	}

	h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Enrollments.Student").First(&lesson, lesson.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Группа обновлена", "group_lesson": lesson})
}

func (h *GroupLessonHandler) DeleteGroupLesson(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}

	if err := h.db.Delete(&lesson).Error; err != nil {
		if strings.Contains(err.Error(), "23503") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить группу: есть связанные записи"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить группу"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Группа удалена"})
}

// ========== ENROLLMENTS ==========

func (h *GroupLessonHandler) GetEnrollments(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var enrollments []models.GroupLessonEnrollment
	if err := h.db.Preload("Student").Where("group_lesson_id = ?", id).Find(&enrollments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить список учеников"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"enrollments": enrollments})
}

func (h *GroupLessonHandler) AddEnrollment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var req struct {
		StudentID uint `json:"student_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.First(&lesson, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
		return
	}

	var count int64
	h.db.Model(&models.GroupLessonEnrollment{}).Where("group_lesson_id = ?", id).Count(&count)
	if int(count) >= lesson.MaxStudents {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Достигнуто максимальное число учеников в группе"})
		return
	}

	enrollment := models.GroupLessonEnrollment{
		GroupLessonID: uint(id),
		StudentID:     req.StudentID,
	}

	if err := h.db.Create(&enrollment).Error; err != nil {
		if strings.Contains(err.Error(), "23505") {
			c.JSON(http.StatusConflict, gin.H{"error": "Ученик уже записан в эту группу"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось добавить ученика"})
		return
	}

	h.db.Preload("Student").First(&enrollment, enrollment.ID)

	c.JSON(http.StatusCreated, gin.H{"message": "Ученик добавлен в группу", "enrollment": enrollment})
}

func (h *GroupLessonHandler) RemoveEnrollment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id ученика"})
		return
	}

	result := h.db.Where("group_lesson_id = ? AND student_id = ?", id, studentID).Delete(&models.GroupLessonEnrollment{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить ученика из группы"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ученик удалён из группы"})
}

// ========== WEEK OVERRIDES ==========

func (h *GroupLessonHandler) GetWeekOverrides(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var overrides []models.GroupLessonWeekOverride
	if err := h.db.Preload("Teacher").Where("group_lesson_id = ?", id).Order("week_start_date ASC").Find(&overrides).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить переопределения"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"overrides": overrides})
}

func (h *GroupLessonHandler) CreateWeekOverride(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var req CreateGroupLessonWeekOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	weekDate, err := parseDate(req.WeekStartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start_date должен быть в формате YYYY-MM-DD"})
		return
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = models.GroupLessonStatusActive
	}

	override := models.GroupLessonWeekOverride{
		GroupLessonID: uint(id),
		WeekStartDate: weekDate,
		TeacherID:     req.TeacherID,
		PlannedVisits: req.PlannedVisits,
		DurationMin:   req.DurationMin,
		Status:        status,
		Notes:         req.Notes,
	}

	if err := h.db.Create(&override).Error; err != nil {
		if strings.Contains(err.Error(), "23505") {
			c.JSON(http.StatusConflict, gin.H{"error": "Переопределение на эту неделю уже существует"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать переопределение"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Переопределение создано", "override": override})
}

func (h *GroupLessonHandler) DeleteWeekOverride(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	overrideID, err := strconv.Atoi(c.Param("overrideId"))
	if err != nil || overrideID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id переопределения"})
		return
	}

	result := h.db.Where("id = ? AND group_lesson_id = ?", overrideID, id).Delete(&models.GroupLessonWeekOverride{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить переопределение"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Переопределение не найдено"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Переопределение удалено"})
}
