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

type CreateTeacherRequest struct {
	FullName string  `json:"full_name" binding:"required"`
	Phone    *string `json:"phone"`
	IsActive *bool   `json:"is_active"`
	Notes    *string `json:"notes"`
}

type UpdateTeacherRequest struct {
	FullName string  `json:"full_name"`
	Phone    *string `json:"phone"`
	IsActive *bool   `json:"is_active"`
	Notes    *string `json:"notes"`
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid is_active value"})
			return
		}
	}

	if err := query.Find(&teachers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teachers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teachers": teachers})
}

func (h *TeacherHandler) GetTeacherByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "full_name is required"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	teacher := models.Teacher{
		FullName: req.FullName,
		Phone:    normalizeOptionalString(req.Phone),
		IsActive: isActive,
		Notes:    normalizeOptionalString(req.Notes),
	}

	if err := h.db.Select("FullName", "Phone", "IsActive", "Notes").Create(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create teacher"})
		return
	}

	if !isActive {
		if err := h.db.Model(&teacher).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create teacher"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
		return
	}

	if req.FullName != "" {
		req.FullName = strings.TrimSpace(req.FullName)
		if req.FullName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "full_name cannot be empty"})
			return
		}
		teacher.FullName = req.FullName
	}

	if req.IsActive != nil {
		teacher.IsActive = *req.IsActive
	}

	if req.Phone != nil {
		teacher.Phone = normalizeOptionalString(req.Phone)
	}

	if req.Notes != nil {
		teacher.Notes = normalizeOptionalString(req.Notes)
	}

	if err := h.db.Save(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update teacher"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
		return
	}

	teacher.IsActive = false

	if err := h.db.Save(&teacher).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate teacher"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Teacher deactivated successfully",
		"teacher": teacher,
	})
}

func (h *TeacherHandler) DeleteTeacher(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
		return
	}

	if err := h.db.Delete(&teacher).Error; err != nil {
		if strings.Contains(err.Error(), "23503") || strings.Contains(err.Error(), "foreign key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить преподавателя: есть связанные назначения или слоты. Сначала деактивируйте."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete teacher"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Teacher deleted successfully"})
}

func (h *TeacherHandler) GetTeacherSubjects(c *gin.Context) {
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

	var teacherSubjects []models.TeacherSubject
	if err := h.db.Preload("Subject").
		Where("teacher_id = ?", teacherID).
		Find(&teacherSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher subjects"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
		return
	}

	uniqueSubjectIDs := make(map[uint]struct{})
	for _, id := range req.SubjectIDs {
		if id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Subject id must be positive"})
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate subjects"})
			return
		}

		if count != int64(len(subjectIDs)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "One or more subject ids are invalid"})
			return
		}
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	if err := tx.Where("teacher_id = ?", teacherID).Delete(&models.TeacherSubject{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear teacher subjects"})
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save teacher subjects"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	var updatedTeacherSubjects []models.TeacherSubject
	if err := h.db.Preload("Subject").
		Where("teacher_id = ?", teacherID).
		Find(&updatedTeacherSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated teacher subjects"})
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

	var availability []models.TeacherAvailability
	if err := h.db.Where("teacher_id = ?", teacherID).
		Order("weekday ASC, start_time ASC").
		Find(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher availability"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher"})
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

	availability := models.TeacherAvailability{
		TeacherID: uint(teacherID),
		Weekday:   req.Weekday,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
	}

	if err := h.db.Create(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create teacher availability"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid availability id"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher availability not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher availability"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update teacher availability"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid teacher id"})
		return
	}

	availabilityID, err := strconv.Atoi(c.Param("availabilityId"))
	if err != nil || availabilityID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid availability id"})
		return
	}

	var availability models.TeacherAvailability
	if err := h.db.Where("id = ? AND teacher_id = ?", availabilityID, teacherID).
		First(&availability).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Teacher availability not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher availability"})
		return
	}

	if err := h.db.Delete(&availability).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete teacher availability"})
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

	var teacherRooms []models.TeacherRoom
	if err := h.db.Preload("Room").Where("teacher_id = ?", teacherID).Find(&teacherRooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teacher rooms"})
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

	var req UpdateTeacherRoomsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := h.db.Begin()

	if err := tx.Where("teacher_id = ?", teacherID).Delete(&models.TeacherRoom{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear teacher rooms"})
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save teacher rooms"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
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
