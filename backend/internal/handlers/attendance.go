package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GET /admin/schedules/:id/slots/:slotId/attendance
func (h *ScheduleHandler) GetSlotAttendance(c *gin.Context) {
	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.First(&slot, slotID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if slot.SlotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Слот не является групповым занятием"})
		return
	}

	var attendance []models.GroupLessonAttendance
	if err := h.db.Preload("Student").
		Where("schedule_slot_id = ?", slotID).
		Order("student_id ASC").
		Find(&attendance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"attendance": attendance})
}

// POST /admin/schedules/:id/slots/:slotId/attendance
func (h *ScheduleHandler) AddSlotStudent(c *gin.Context) {
	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req struct {
		StudentID uint `json:"student_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.First(&slot, slotID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}
	if slot.SlotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Слот не является групповым занятием"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}

	record := models.GroupLessonAttendance{
		ScheduleSlotID: uint(slotID),
		StudentID:      req.StudentID,
	}
	if err := h.db.Create(&record).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Ученик уже добавлен в этот слот"})
		return
	}

	record.Student = student
	c.JSON(http.StatusCreated, gin.H{"attendance": record})
}

// PATCH /admin/schedules/:id/slots/:slotId/attendance/:studentId
func (h *ScheduleHandler) UpdateAttendance(c *gin.Context) {
	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var req struct {
		Attended *bool `json:"attended"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var record models.GroupLessonAttendance
	if err := h.db.Preload("Student").
		Where("schedule_slot_id = ? AND student_id = ?", slotID, studentID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись посещаемости не найдена"})
		return
	}

	record.Attended = req.Attended
	if err := h.db.Save(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"attendance": record})
}

// DELETE /admin/schedules/:id/slots/:slotId/attendance/:studentId
func (h *ScheduleHandler) RemoveSlotStudent(c *gin.Context) {
	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	result := h.db.Where("schedule_slot_id = ? AND student_id = ?", slotID, studentID).
		Delete(&models.GroupLessonAttendance{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student removed from session"})
}
