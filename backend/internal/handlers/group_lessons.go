package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	Name                 string `json:"name" binding:"required"`
	SubjectID            *uint  `json:"subject_id"`
	DefaultTeacherID     *uint  `json:"default_teacher_id"`
	TeacherIDs           []uint `json:"teacher_ids"`
	TeacherHoursMode     string `json:"teacher_hours_mode"`
	RoomName             string `json:"room_name"`
	VisitsPerWeek        int    `json:"visits_per_week" binding:"required"`
	DurationMin          int    `json:"duration_min" binding:"required"`
	MaxStudents          int    `json:"max_students"`
	Status               string `json:"status"`
	IgnoreStudentWindows bool   `json:"ignore_student_windows"`
}

type UpdateGroupLessonRequest struct {
	Name                 string  `json:"name"`
	SubjectID            *uint   `json:"subject_id"`
	DefaultTeacherID     *uint   `json:"default_teacher_id"`
	TeacherIDs           []uint  `json:"teacher_ids"`
	TeacherHoursMode     *string `json:"teacher_hours_mode"`
	RoomName             *string `json:"room_name"`
	VisitsPerWeek        *int    `json:"visits_per_week"`
	DurationMin          *int    `json:"duration_min"`
	MaxStudents          *int    `json:"max_students"`
	Status               string  `json:"status"`
	IgnoreStudentWindows *bool   `json:"ignore_student_windows"`
}

func (h *GroupLessonHandler) GetGroupLessons(c *gin.Context) {
	var lessons []models.GroupLesson

	query := h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Teachers.Teacher").Preload("Enrollments.Student").Order("id ASC")
	if c.Query("archived") == "true" {
		query = query.Where("archived_at IS NOT NULL")
	} else {
		query = query.Where("archived_at IS NULL")
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&lessons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить список групп"})
		return
	}
	for index := range lessons {
		hydrateLegacyGroupTeachers(&lessons[index])
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
	if err := h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Teachers.Teacher").Preload("Enrollments.Student").First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}
	hydrateLegacyGroupTeachers(&lesson)

	c.JSON(http.StatusOK, gin.H{"group_lesson": lesson})
}

func hydrateLegacyGroupTeachers(lesson *models.GroupLesson) {
	if len(lesson.Teachers) == 0 && lesson.DefaultTeacherID != nil {
		teacher := models.Teacher{ID: *lesson.DefaultTeacherID}
		if lesson.DefaultTeacher != nil {
			teacher = *lesson.DefaultTeacher
		}
		lesson.Teachers = []models.GroupLessonTeacher{{
			GroupLessonID: lesson.ID,
			TeacherID:     *lesson.DefaultTeacherID,
			Teacher:       teacher,
		}}
	}
}

func (h *GroupLessonHandler) CreateGroupLesson(c *gin.Context) {
	var req CreateGroupLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.VisitsPerWeek <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Количество занятий в неделю должно быть больше 0"})
		return
	}
	if req.DurationMin <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Длительность занятия должна быть больше 0"})
		return
	}
	if err := h.validateGroupTeacherIDs(req.TeacherIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	mode := strings.TrimSpace(req.TeacherHoursMode)
	if mode == "" {
		mode = models.TeacherHoursModeFull
	}
	if !validTeacherHoursMode(mode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Режим учёта часов должен быть full или split"})
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
		Name:                 req.Name,
		SubjectID:            req.SubjectID,
		DefaultTeacherID:     uintPtr(req.TeacherIDs[0]),
		TeacherHoursMode:     mode,
		RoomName:             strings.TrimSpace(req.RoomName),
		VisitsPerWeek:        req.VisitsPerWeek,
		DurationMin:          req.DurationMin,
		MaxStudents:          maxStudents,
		Status:               status,
		IgnoreStudentWindows: req.IgnoreStudentWindows,
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать группу"})
		return
	}
	if err := tx.Create(&lesson).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать группу"})
		return
	}
	if err := replaceGroupLessonTeachers(tx, lesson.ID, req.TeacherIDs); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить преподавателей группы"})
		return
	}
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать группу"})
		return
	}

	h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Teachers.Teacher").First(&lesson, lesson.ID)
	logging.AdminMutation(c, "schedule.group_lesson.create", nil, groupLessonAuditSnapshot(lesson))

	c.JSON(http.StatusCreated, gin.H{"message": "Группа создана", "group_lesson": lesson})
}

func (h *GroupLessonHandler) UpdateGroupLesson(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.Preload("Teachers").First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}
	before := groupLessonAuditSnapshot(lesson)

	var req UpdateGroupLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) != "" {
		lesson.Name = req.Name
	}
	if req.SubjectID != nil {
		lesson.SubjectID = req.SubjectID
	}
	// default_teacher_id was the old single-teacher API. Treat it as a
	// one-element teacher list when an older client still sends it, so the
	// canonical relation and legacy fallback can never diverge.
	if req.TeacherIDs == nil && req.DefaultTeacherID != nil {
		req.TeacherIDs = []uint{*req.DefaultTeacherID}
	}
	if req.TeacherHoursMode != nil {
		mode := strings.TrimSpace(*req.TeacherHoursMode)
		if !validTeacherHoursMode(mode) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Режим учёта часов должен быть full или split"})
			return
		}
		lesson.TeacherHoursMode = mode
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
	if req.IgnoreStudentWindows != nil {
		lesson.IgnoreStudentWindows = *req.IgnoreStudentWindows
	}

	if req.TeacherIDs != nil {
		if err := h.validateGroupTeacherIDs(req.TeacherIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		lesson.DefaultTeacherID = uintPtr(req.TeacherIDs[0])
	}
	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить группу"})
		return
	}
	if err := tx.Save(&lesson).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить группу"})
		return
	}
	if req.TeacherIDs != nil {
		if err := replaceGroupLessonTeachers(tx, lesson.ID, req.TeacherIDs); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить преподавателей группы"})
			return
		}
	}
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить группу"})
		return
	}

	h.db.Preload("Subject").Preload("DefaultTeacher").Preload("Teachers.Teacher").Preload("Enrollments.Student").First(&lesson, lesson.ID)
	logging.AdminMutation(c, "schedule.group_lesson.update", before, groupLessonAuditSnapshot(lesson))

	c.JSON(http.StatusOK, gin.H{"message": "Группа обновлена", "group_lesson": lesson})
}

func validTeacherHoursMode(mode string) bool {
	return mode == models.TeacherHoursModeFull || mode == models.TeacherHoursModeSplit
}

func uintPtr(value uint) *uint { return &value }

func uniquePositiveIDs(ids []uint) ([]uint, bool) {
	seen := make(map[uint]struct{}, len(ids))
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			return nil, false
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result, len(result) > 0
}

func (h *GroupLessonHandler) validateGroupTeacherIDs(ids []uint) error {
	unique, ok := uniquePositiveIDs(ids)
	if !ok {
		return fmt.Errorf("У группового занятия должен быть хотя бы один преподаватель")
	}
	var count int64
	if err := h.db.Model(&models.Teacher{}).Where("id IN ? AND is_active = ?", unique, true).Count(&count).Error; err != nil {
		return fmt.Errorf("Не удалось проверить преподавателей")
	}
	if count != int64(len(unique)) {
		return fmt.Errorf("Выбран несуществующий или неактивный преподаватель")
	}
	return nil
}

func replaceGroupLessonTeachers(db *gorm.DB, groupLessonID uint, ids []uint) error {
	unique, ok := uniquePositiveIDs(ids)
	if !ok {
		return fmt.Errorf("Для группового занятия необходимо указать хотя бы одного преподавателя")
	}
	if err := db.Where("group_lesson_id = ?", groupLessonID).Delete(&models.GroupLessonTeacher{}).Error; err != nil {
		return err
	}
	links := make([]models.GroupLessonTeacher, 0, len(unique))
	for _, teacherID := range unique {
		links = append(links, models.GroupLessonTeacher{GroupLessonID: groupLessonID, TeacherID: teacherID})
	}
	return db.Create(&links).Error
}

func (h *GroupLessonHandler) DeleteGroupLesson(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный id группы"})
		return
	}

	var lesson models.GroupLesson
	if err := h.db.Preload("Teachers").First(&lesson, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Группа не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить группу"})
		return
	}
	before := groupLessonAuditSnapshot(lesson)
	now := time.Now()
	if err := h.db.Model(&lesson).Update("archived_at", now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось переместить группу в архив"})
		return
	}
	logging.AdminMutation(c, "schedule.group_lesson.archive", before, nil)
	c.JSON(http.StatusOK, gin.H{"message": "Группа перемещена в архив"})
}

func (h *GroupLessonHandler) RestoreGroupLesson(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	if err := h.db.Model(&models.GroupLesson{}).Where("id = ? AND archived_at IS NOT NULL", id).Update("archived_at", nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось восстановить группу"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Группа восстановлена"})
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
