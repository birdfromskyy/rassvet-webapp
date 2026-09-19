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
	slot, ok := h.getScheduleGroupSlot(c)
	if !ok {
		return
	}

	var attendance []models.GroupLessonAttendance
	if err := h.db.Preload("Student").
		Where("schedule_slot_id = ?", slot.ID).
		Order("student_id ASC").
		Find(&attendance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"attendance": attendance})
}

// POST /admin/schedules/:id/slots/:slotId/attendance
func (h *ScheduleHandler) AddSlotStudent(c *gin.Context) {
	var req struct {
		StudentID uint `json:"student_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slot, ok := h.getScheduleGroupSlot(c)
	if !ok {
		return
	}

	var student models.Student
	if err := h.db.First(&student, req.StudentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}

	record := models.GroupLessonAttendance{
		ScheduleSlotID: slot.ID,
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
	slot, ok := h.getScheduleGroupSlot(c)
	if !ok {
		return
	}

	var record models.GroupLessonAttendance
	if err := h.db.Preload("Student").
		Where("schedule_slot_id = ? AND student_id = ?", slot.ID, studentID).
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
	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}
	slot, ok := h.getScheduleGroupSlot(c)
	if !ok {
		return
	}

	result := h.db.Where("schedule_slot_id = ? AND student_id = ?", slot.ID, studentID).
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

// getScheduleGroupSlot makes the nested attendance routes safe: a slot from
// another weekly schedule cannot be read or changed through this URL.
func (h *ScheduleHandler) getScheduleGroupSlot(c *gin.Context) (models.ScheduleSlot, bool) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return models.ScheduleSlot{}, false
	}
	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return models.ScheduleSlot{}, false
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
			return models.ScheduleSlot{}, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return models.ScheduleSlot{}, false
	}
	if slot.SlotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Слот не является групповым занятием"})
		return models.ScheduleSlot{}, false
	}
	return slot, true
}
