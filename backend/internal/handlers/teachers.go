package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TeacherHandler struct {
	db *gorm.DB
}

func NewTeacherHandler(db *gorm.DB) *TeacherHandler {
	return &TeacherHandler{db: db}
}

// GetPublicTeachers returns teachers marked as show_on_site=true, ordered for the public /employees page.
func (h *TeacherHandler) GetPublicTeachers(c *gin.Context) {
	var teachers []models.Teacher
	h.db.Where("show_on_site = ?", true).Order("sort_order_cms ASC, id ASC").Find(&teachers)
	c.JSON(http.StatusOK, teachers)
}

type CreateTeacherRequest struct {
	FullName string `json:"full_name" binding:"required"`
	IsActive *bool  `json:"is_active"`
	// CMS fields
	Category       string `json:"category"`
	PhotoURL       string `json:"photo_url"`
	Qualifications string `json:"qualifications"`
	Education      string `json:"education"`
	Experience     string `json:"experience"`
	SortOrderCMS   int    `json:"sort_order_cms"`
	ShowOnSite     *bool  `json:"show_on_site"`
}

type UpdateTeacherRequest struct {
	FullName string `json:"full_name"`
	IsActive *bool  `json:"is_active"`
	// CMS fields
	Category       string `json:"category"`
	PhotoURL       string `json:"photo_url"`
	Qualifications string `json:"qualifications"`
	Education      string `json:"education"`
	Experience     string `json:"experience"`
	SortOrderCMS   *int   `json:"sort_order_cms"`
	ShowOnSite     *bool  `json:"show_on_site"`
}

type UpdateTeacherSubjectsRequest struct {
	SubjectIDs []uint `json:"subject_ids" binding:"required"`
}

type CreateTeacherAvailabilityRequest struct {
	Weekday   int    `json:"weekday" binding:"required"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}

type UpdateTeacherAvailabilityRequest struct {
	Weekday   *int   `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func (h *TeacherHandler) GetTeachers(c *gin.Context) {
	var teachers []models.Teacher

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

	if err := query.Find(&teachers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teachers": teachers})
}

func (h *TeacherHandler) GetTeacherByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teacher": teacher})
}

func (h *TeacherHandler) CreateTeacher(c *gin.Context) {
	var req CreateTeacherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле «ФИО» обязательно"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	showOnSite := false
	if req.ShowOnSite != nil {
		showOnSite = *req.ShowOnSite
	}

	teacher := models.Teacher{
		FullName:       req.FullName,
		IsActive:       isActive,
		Category:       req.Category,
		PhotoURL:       req.PhotoURL,
		Qualifications: req.Qualifications,
		Education:      req.Education,
		Experience:     req.Experience,
		SortOrderCMS:   req.SortOrderCMS,
		ShowOnSite:     showOnSite,
	}

	if err := h.db.Create(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать преподавателя"})
		return
	}

	if !isActive {
		if err := h.db.Model(&teacher).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать преподавателя"})
			return
		}
		teacher.IsActive = false
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Teacher created successfully",
		"teacher": teacher,
	})
}

func (h *TeacherHandler) UpdateTeacher(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req UpdateTeacherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
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
		teacher.FullName = req.FullName
	}

	if req.IsActive != nil {
		teacher.IsActive = *req.IsActive
	}

	// CMS fields — always update (allow clearing)
	teacher.Category = req.Category
	teacher.PhotoURL = req.PhotoURL
	teacher.Qualifications = req.Qualifications
	teacher.Education = req.Education
	teacher.Experience = req.Experience
	if req.SortOrderCMS != nil {
		teacher.SortOrderCMS = *req.SortOrderCMS
	}
	if req.ShowOnSite != nil {
		teacher.ShowOnSite = *req.ShowOnSite
	}

	if err := h.db.Save(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить преподавателя"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Teacher updated successfully",
		"teacher": teacher,
	})
}

func (h *TeacherHandler) DeactivateTeacher(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	teacher.IsActive = false

	if err := h.db.Save(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Teacher deactivated successfully",
		"teacher": teacher,
	})
}

func (h *TeacherHandler) ActivateTeacher(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	teacher.IsActive = true

	if err := h.db.Save(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Teacher activated successfully",
		"teacher": teacher,
	})
}

func (h *TeacherHandler) DeleteTeacher(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	var activeAssignments int64
	if err := h.db.Model(&models.Assignment{}).
		Where("teacher_id = ? AND status = ?", teacher.ID, models.AssignmentStatusActive).
		Count(&activeAssignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	if activeAssignments > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить преподавателя: есть активные назначения. Сначала поставьте их на паузу."})
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		slotIDs := tx.Model(&models.ScheduleSlot{}).Select("id").Where("teacher_id = ?", teacher.ID)
		if err := tx.Where("schedule_slot_id IN (?)", slotIDs).Delete(&models.ScheduleSlotExclusion{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.ScheduleSlot{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.ScheduleGenerationIssue{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.TeacherSubject{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.TeacherRoom{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.TeacherAvailability{}).Error; err != nil {
			return err
		}
		assignmentIDs := tx.Model(&models.Assignment{}).Select("id").Where("teacher_id = ?", teacher.ID)
		if err := tx.Where("assignment_id IN (?)", assignmentIDs).Delete(&models.AssignmentWeekOverride{}).Error; err != nil {
			return err
		}
		if err := tx.Where("teacher_id = ?", teacher.ID).Delete(&models.Assignment{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.GroupLesson{}).Where("default_teacher_id = ?", teacher.ID).Update("default_teacher_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.GroupLessonWeekOverride{}).Where("teacher_id = ?", teacher.ID).Update("teacher_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&teacher).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить преподавателя"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Teacher deleted successfully"})
}

func (h *TeacherHandler) GetTeacherSubjects(c *gin.Context) {
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

	var teacherSubjects []models.TeacherSubject
	if err := h.db.Preload("Subject").
		Where("teacher_id = ?", teacherID).
		Find(&teacherSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teacher_id":       teacher.ID,
		"teacher_name":     teacher.FullName,
		"teacher_subjects": teacherSubjects,
	})
}

func (h *TeacherHandler) UpdateTeacherSubjects(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req UpdateTeacherSubjectsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	uniqueSubjectIDs := make(map[uint]struct{})
	for _, id := range req.SubjectIDs {
		if id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID предмета должен быть положительным числом"})
			return
		}
		uniqueSubjectIDs[id] = struct{}{}
	}

	subjectIDs := make([]uint, 0, len(uniqueSubjectIDs))
	for id := range uniqueSubjectIDs {
		subjectIDs = append(subjectIDs, id)
	}

	if len(subjectIDs) > 0 {
		var count int64
		if err := h.db.Model(&models.Subject{}).
			Where("id IN ?", subjectIDs).
			Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки предметов"})
			return
		}

		if count != int64(len(subjectIDs)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Один или несколько ID предметов не существуют"})
			return
		}
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	if err := tx.Where("teacher_id = ?", teacherID).Delete(&models.TeacherSubject{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	if len(subjectIDs) > 0 {
		teacherSubjects := make([]models.TeacherSubject, 0, len(subjectIDs))
		for _, subjectID := range subjectIDs {
			teacherSubjects = append(teacherSubjects, models.TeacherSubject{
				TeacherID: uint(teacherID),
				SubjectID: subjectID,
			})
		}

		if err := tx.Create(&teacherSubjects).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить данные"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	var updatedTeacherSubjects []models.TeacherSubject
	if err := h.db.Preload("Subject").
		Where("teacher_id = ?", teacherID).
		Find(&updatedTeacherSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Teacher subjects updated successfully",
		"teacher_id":       teacher.ID,
		"teacher_name":     teacher.FullName,
		"teacher_subjects": updatedTeacherSubjects,
	})
}

func (h *TeacherHandler) GetTeacherAvailability(c *gin.Context) {
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

	var availability []models.TeacherAvailability
	if err := h.db.Where("teacher_id = ?", teacherID).
		Order("weekday ASC, start_time ASC").
		Find(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teacher_id":   teacher.ID,
		"teacher_name": teacher.FullName,
		"availability": availability,
	})
}

func (h *TeacherHandler) CreateTeacherAvailability(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req CreateTeacherAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	availability := models.TeacherAvailability{
		TeacherID: uint(teacherID),
		Weekday:   req.Weekday,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
	}

	if err := h.db.Create(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Teacher availability created successfully",
		"availability": availability,
	})
}

func (h *TeacherHandler) UpdateTeacherAvailability(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req UpdateTeacherAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var availability models.TeacherAvailability
	if err := h.db.Where("id = ? AND teacher_id = ?", availabilityID, teacherID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Окно доступности преподавателя не найдено"})
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
		"message":      "Teacher availability updated successfully",
		"availability": availability,
	})
}

func (h *TeacherHandler) DeleteTeacherAvailability(c *gin.Context) {
	teacherID, err := strconv.Atoi(c.Param("id"))
	if err != nil || teacherID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var availability models.TeacherAvailability
	if err := h.db.Where("id = ? AND teacher_id = ?", availabilityID, teacherID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Окно доступности преподавателя не найдено"})
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
		"message": "Teacher availability deleted successfully",
	})
}

// ========== TEACHER ROOMS ==========

type UpdateTeacherRoomsRequest struct {
	RoomIDs  []uint `json:"room_ids" binding:"required"`
	IsStrict bool   `json:"is_strict"`
}

func (h *TeacherHandler) GetTeacherRooms(c *gin.Context) {
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

	var teacherRooms []models.TeacherRoom
	if err := h.db.Preload("Room").Where("teacher_id = ?", teacherID).Find(&teacherRooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teacher_id":    teacher.ID,
		"teacher_name":  teacher.FullName,
		"teacher_rooms": teacherRooms,
	})
}

func (h *TeacherHandler) UpdateTeacherRooms(c *gin.Context) {
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

	var req UpdateTeacherRoomsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := h.db.Begin()

	if err := tx.Where("teacher_id = ?", teacherID).Delete(&models.TeacherRoom{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	if len(req.RoomIDs) > 0 {
		teacherRooms := make([]models.TeacherRoom, 0, len(req.RoomIDs))
		for _, roomID := range req.RoomIDs {
			teacherRooms = append(teacherRooms, models.TeacherRoom{
				TeacherID: uint(teacherID),
				RoomID:    roomID,
				IsStrict:  req.IsStrict,
			})
		}
		if err := tx.Create(&teacherRooms).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить данные"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	var updatedRooms []models.TeacherRoom
	h.db.Preload("Room").Where("teacher_id = ?", teacherID).Find(&updatedRooms)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Кабинеты преподавателя обновлены",
		"teacher_id":    teacher.ID,
		"teacher_rooms": updatedRooms,
	})
}

func (h *TeacherHandler) LinkUserToTeacher(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var req struct {
		TeacherID uint `json:"teacher_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите teacher_id"})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
		return
	}
	if user.Role != models.RoleTeacher {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Пользователь не является сотрудником"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, req.TeacherID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Преподаватель не найден"})
		return
	}

	uid := uint(userID)
	if err := h.db.Model(&teacher).Update("user_id", uid).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка привязки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Преподаватель привязан к аккаунту"})
}

func (h *TeacherHandler) UnlinkUserFromTeacher(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var teacher models.Teacher
	if err := h.db.Where("user_id = ?", userID).First(&teacher).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Привязанный преподаватель не найден"})
		return
	}

	if err := h.db.Model(&teacher).Update("user_id", nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка отвязки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Преподаватель отвязан от аккаунта"})
}

func (h *TeacherHandler) GetLinkedTeacher(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID пользователя"})
		return
	}

	var teacher models.Teacher
	if err := h.db.Where("user_id = ?", userID).First(&teacher).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"teacher": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teacher": teacher})
}
