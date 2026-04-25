package handlers

import (
	"backend/internal/models"
	"backend/internal/services"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ScheduleHandler struct {
	db        *gorm.DB
	generator *services.ScheduleGenerator
}

func NewScheduleHandler(db *gorm.DB, generator *services.ScheduleGenerator) *ScheduleHandler {
	return &ScheduleHandler{
		db:        db,
		generator: generator,
	}
}

type GenerateScheduleRequest struct {
	WeekStartDate string `json:"week_start_date" binding:"required"`
}

type CreateManualSlotRequest struct {
	AssignmentID uint   `json:"assignment_id" binding:"required"`
	StudentID    uint   `json:"student_id" binding:"required"`
	TeacherID    uint   `json:"teacher_id" binding:"required"`
	SubjectID    uint   `json:"subject_id" binding:"required"`
	RoomID       uint   `json:"room_id" binding:"required"`
	Weekday      int    `json:"weekday" binding:"required"`
	StartTime    string `json:"start_time" binding:"required"`
	EndTime      string `json:"end_time" binding:"required"`
}

type UpdateScheduleSlotRequest struct {
	RoomID    *uint  `json:"room_id"`
	Weekday   *int   `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Status    string `json:"status"`
}

func (h *ScheduleHandler) GetScheduleByWeek(c *gin.Context) {
	weekStart := strings.TrimSpace(c.Query("week_start"))
	if weekStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start query param is required"})
		return
	}

	parsedWeekStart, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start must be in YYYY-MM-DD format"})
		return
	}

	var schedule models.Schedule
	if err := h.db.Where("week_start_date = ?", parsedWeekStart).First(&schedule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) GetScheduleByID(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) GenerateSchedule(c *gin.Context) {
	var req GenerateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	weekStartDate, err := time.Parse("2006-01-02", req.WeekStartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "week_start_date must be in YYYY-MM-DD format"})
		return
	}

	userIDValue, exists := c.Get("userID")
	var generatedByUserID uint
	if exists {
		switch v := userIDValue.(type) {
		case uint:
			generatedByUserID = v
		case int:
			generatedByUserID = uint(v)
		case int64:
			generatedByUserID = uint(v)
		case float64:
			generatedByUserID = uint(v)
		}
	}

	result, err := h.generator.GenerateSchedule(weekStartDate, generatedByUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *ScheduleHandler) ApproveSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	now := time.Now()

	userIDValue, exists := c.Get("userID")
	if exists {
		switch v := userIDValue.(type) {
		case uint:
			schedule.ApprovedByUserID = &v
		case int:
			u := uint(v)
			schedule.ApprovedByUserID = &u
		case int64:
			u := uint(v)
			schedule.ApprovedByUserID = &u
		case float64:
			u := uint(v)
			schedule.ApprovedByUserID = &u
		}
	}

	schedule.Status = models.ScheduleStatusApproved
	schedule.ApprovedAt = &now

	if err := h.db.Save(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve schedule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Schedule approved successfully",
		"schedule": schedule,
	})
}

func (h *ScheduleHandler) UnapproveSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	if schedule.Status != models.ScheduleStatusApproved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Расписание не является утверждённым"})
		return
	}

	schedule.Status = models.ScheduleStatusDraft
	schedule.ApprovedAt = nil
	schedule.ApprovedByUserID = nil

	if err := h.db.Save(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unapprove schedule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Schedule unapproved successfully",
		"schedule": schedule,
	})
}

func (h *ScheduleHandler) ResetAutoSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	userIDValue, exists := c.Get("userID")
	var generatedByUserID uint
	if exists {
		switch v := userIDValue.(type) {
		case uint:
			generatedByUserID = v
		case int:
			generatedByUserID = uint(v)
		case int64:
			generatedByUserID = uint(v)
		case float64:
			generatedByUserID = uint(v)
		}
	}

	result, err := h.generator.ResetAutoSchedule(schedule.ID, generatedByUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *ScheduleHandler) CreateScheduleSlot(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var req CreateManualSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.AssignmentID == 0 || req.StudentID == 0 || req.TeacherID == 0 || req.SubjectID == 0 || req.RoomID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assignment_id, student_id, teacher_id, subject_id and room_id must be positive"})
		return
	}

	if !isValidWeekday(req.Weekday) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "weekday must be between 1 and 7"})
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

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	if err := h.ensureManualSlotRelations(req.AssignmentID, req.StudentID, req.TeacherID, req.SubjectID, req.RoomID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slot := models.ScheduleSlot{
		ScheduleID:   uint(scheduleID),
		AssignmentID: &req.AssignmentID,
		StudentID:    &req.StudentID,
		TeacherID:    req.TeacherID,
		SubjectID:    req.SubjectID,
		RoomID:       req.RoomID,
		Weekday:      req.Weekday,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Origin:       models.ScheduleSlotOriginManual,
		Status:       models.ScheduleSlotStatusScheduled,
	}

	if err := h.db.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create schedule slot"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch created schedule slot"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Manual schedule slot created successfully",
		"slot":    slot,
	})
}

func (h *ScheduleHandler) UpdateScheduleSlot(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slot id"})
		return
	}

	var req UpdateScheduleSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).
		First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule slot not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule slot"})
		return
	}

	if req.RoomID != nil {
		if *req.RoomID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room_id must be positive"})
			return
		}
		slot.RoomID = *req.RoomID
	}

	if req.Weekday != nil {
		if !isValidWeekday(*req.Weekday) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "weekday must be between 1 and 7"})
			return
		}
		slot.Weekday = *req.Weekday
	}

	if req.StartTime != "" {
		if !isValidTimeHHMM(req.StartTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be in HH:MM format"})
			return
		}
		slot.StartTime = req.StartTime
	}

	if req.EndTime != "" {
		if !isValidTimeHHMM(req.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "end_time must be in HH:MM format"})
			return
		}
		slot.EndTime = req.EndTime
	}

	if !isStartBeforeEnd(slot.StartTime, slot.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be earlier than end_time"})
		return
	}

	if strings.TrimSpace(req.Status) != "" {
		switch req.Status {
		case models.ScheduleSlotStatusScheduled, models.ScheduleSlotStatusMoved, models.ScheduleSlotStatusCancelled:
			slot.Status = req.Status
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slot status"})
			return
		}
	}

	slot.Origin = models.ScheduleSlotOriginManual

	if err := h.db.Save(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update schedule slot"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated schedule slot"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot updated successfully",
		"slot":    slot,
	})
}

func (h *ScheduleHandler) DeleteScheduleSlot(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slot id"})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).
		First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule slot not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule slot"})
		return
	}

	if err := h.db.Delete(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete schedule slot"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot deleted successfully",
	})
}

func (h *ScheduleHandler) ClearAutoSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule"})
		return
	}

	if err := h.generator.CleanupAutoSlots(schedule.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear auto slots"})
		return
	}
	if err := h.generator.CleanupGenerationIssues(schedule.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear generation issues"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) respondWithSchedule(c *gin.Context, schedule *models.Schedule) {
	var slots []models.ScheduleSlot
	if err := h.db.
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("Exclusions").
		Preload("Exclusions.Student").
		Where("schedule_id = ?", schedule.ID).
		Order("weekday ASC, start_time ASC, id ASC").
		Find(&slots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule slots"})
		return
	}

	var issues []models.ScheduleGenerationIssue
	if err := h.db.
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Assignment").
		Preload("GroupLesson").
		Where("schedule_id = ?", schedule.ID).
		Order("id ASC").
		Find(&issues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule issues"})
		return
	}

	totalRequested := h.countRequestedVisitsFromSchedule(schedule)
	scheduled := len(slots)
	unplaced := len(issues)

	c.JSON(http.StatusOK, gin.H{
		"schedule": gin.H{
			"id":                   schedule.ID,
			"week_start_date":      schedule.WeekStartDate.Format("2006-01-02"),
			"week_end_date":        schedule.WeekEndDate.Format("2006-01-02"),
			"status":               schedule.Status,
			"generated_at":         schedule.GeneratedAt,
			"generated_by_user_id": schedule.GeneratedByUserID,
			"approved_at":          schedule.ApprovedAt,
			"approved_by_user_id":  schedule.ApprovedByUserID,
		},
		"slots":  slots,
		"issues": issues,
		"stats": gin.H{
			"total_requested": totalRequested,
			"scheduled":       scheduled,
			"unplaced":        unplaced,
		},
	})
}

func (h *ScheduleHandler) countRequestedVisitsFromSchedule(schedule *models.Schedule) int {
	var overrides []models.AssignmentWeekOverride
	if err := h.db.Where("week_start_date = ?", schedule.WeekStartDate).Find(&overrides).Error; err == nil {
		if len(overrides) > 0 {
			total := 0
			for _, o := range overrides {
				if o.Status == models.AssignmentStatusPaused {
					continue
				}
				total += o.PlannedVisits
			}
			return total
		}
	}

	var assignments []models.Assignment
	if err := h.db.Where("status = ?", models.AssignmentStatusActive).Find(&assignments).Error; err == nil {
		total := 0
		for _, a := range assignments {
			total += a.VisitsPerWeek
		}
		return total
	}

	return 0
}

func (h *ScheduleHandler) ensureManualSlotRelations(assignmentID, studentID, teacherID, subjectID, roomID uint) error {
	var assignment models.Assignment
	if err := h.db.First(&assignment, assignmentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("assignment not found")
		}
		return err
	}

	if assignment.StudentID != studentID || assignment.TeacherID != teacherID || assignment.SubjectID != subjectID {
		return fmt.Errorf("assignment does not match student, teacher or subject")
	}

	var room models.Room
	if err := h.db.First(&room, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("room not found")
		}
		return err
	}

	var roomSubject models.RoomSubject
	if err := h.db.Where("room_id = ? AND subject_id = ?", roomID, subjectID).First(&roomSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("room is not allowed for this subject")
		}
		return err
	}

	return nil
}

// ========== SLOT EXCLUSIONS (для групповых слотов) ==========

func (h *ScheduleHandler) AddSlotExclusion(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slot id"})
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
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule slot not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule slot"})
		return
	}

	if slot.SlotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Исключение возможно только для групповых слотов"})
		return
	}

	exclusion := models.ScheduleSlotExclusion{
		ScheduleSlotID: slot.ID,
		StudentID:      req.StudentID,
	}

	if err := h.db.Create(&exclusion).Error; err != nil {
		if strings.Contains(err.Error(), "23505") {
			c.JSON(http.StatusConflict, gin.H{"error": "Ученик уже исключён из этого занятия"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exclusion"})
		return
	}

	h.db.Preload("Student").First(&exclusion, exclusion.ID)
	c.JSON(http.StatusCreated, gin.H{"message": "Ученик исключён из занятия", "exclusion": exclusion})
}

func (h *ScheduleHandler) RemoveSlotExclusion(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slot id"})
		return
	}

	studentID, err := strconv.Atoi(c.Param("studentId"))
	if err != nil || studentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Schedule slot not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch schedule slot"})
		return
	}

	result := h.db.Where("schedule_slot_id = ? AND student_id = ?", slot.ID, studentID).Delete(&models.ScheduleSlotExclusion{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove exclusion"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exclusion not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Исключение снято"})
}
