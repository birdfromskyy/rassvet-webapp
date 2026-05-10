package handlers

import (
	"backend/internal/models"
	"backend/internal/services"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ScheduleHandler struct {
	db        *gorm.DB
	generator *services.ScheduleGenerator
	jobs      *ScheduleGenerationJobManager
}

func NewScheduleHandler(db *gorm.DB, generator *services.ScheduleGenerator) *ScheduleHandler {
	return &ScheduleHandler{
		db:        db,
		generator: generator,
		jobs:      NewScheduleGenerationJobManager(),
	}
}

type GenerateScheduleRequest struct {
	WeekStartDate string `json:"week_start_date" binding:"required"`
}

type ScheduleGenerationJob struct {
	ID        string                     `json:"id"`
	Status    string                     `json:"status"`
	Percent   int                        `json:"percent"`
	Message   string                     `json:"message"`
	Strategy  string                     `json:"strategy,omitempty"`
	Error     string                     `json:"error,omitempty"`
	Result    *services.ScheduleResponse `json:"result,omitempty"`
	CreatedAt time.Time                  `json:"created_at"`
	UpdatedAt time.Time                  `json:"updated_at"`
}

type ScheduleGenerationJobManager struct {
	mu   sync.RWMutex
	jobs map[string]*ScheduleGenerationJob
}

func NewScheduleGenerationJobManager() *ScheduleGenerationJobManager {
	return &ScheduleGenerationJobManager{
		jobs: make(map[string]*ScheduleGenerationJob),
	}
}

func (m *ScheduleGenerationJobManager) Create(message string) *ScheduleGenerationJob {
	now := time.Now()
	job := &ScheduleGenerationJob{
		ID:        newScheduleGenerationJobID(),
		Status:    "running",
		Percent:   0,
		Message:   message,
		CreatedAt: now,
		UpdatedAt: now,
	}
	m.mu.Lock()
	m.jobs[job.ID] = job
	m.mu.Unlock()
	return job
}

func (m *ScheduleGenerationJobManager) Update(id string, update func(*ScheduleGenerationJob)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[id]
	if !ok {
		return
	}
	update(job)
	job.UpdatedAt = time.Now()
}

func (m *ScheduleGenerationJobManager) Get(id string) (*ScheduleGenerationJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	copyJob := *job
	return &copyJob, true
}

func newScheduleGenerationJobID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes[:])
}

func currentUserID(c *gin.Context) uint {
	userIDValue, exists := c.Get("userID")
	if !exists {
		return 0
	}
	switch v := userIDValue.(type) {
	case uint:
		return v
	case int:
		return uint(v)
	case int64:
		return uint(v)
	case float64:
		return uint(v)
	default:
		return 0
	}
}

type CreateManualSlotRequest struct {
	SlotType      string `json:"slot_type"`
	AssignmentID  uint   `json:"assignment_id"`
	GroupLessonID uint   `json:"group_lesson_id"`
	StudentID     uint   `json:"student_id"`
	TeacherID     uint   `json:"teacher_id" binding:"required"`
	SubjectID     uint   `json:"subject_id"`
	RoomID        uint   `json:"room_id"`
	RoomName      string `json:"room_name"`
	Weekday       int    `json:"weekday" binding:"required"`
	StartTime     string `json:"start_time" binding:"required"`
	EndTime       string `json:"end_time" binding:"required"`
}

type UpdateScheduleSlotRequest struct {
	RoomID    *uint  `json:"room_id"`
	Weekday   *int   `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Status    string `json:"status"`
	RoomName  string `json:"room_name"`
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

func (h *ScheduleHandler) StartGenerateSchedule(c *gin.Context) {
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

	generatedByUserID := currentUserID(c)
	job := h.jobs.Create("Генерация поставлена в очередь")
	jobResponse := *job

	go func() {
		progress := func(p services.ScheduleGenerationProgress) {
			h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
				job.Percent = p.Percent
				job.Message = p.Message
				job.Strategy = p.Strategy
			})
		}

		result, err := h.generator.GenerateScheduleWithProgress(weekStartDate, generatedByUserID, progress)
		if err != nil {
			h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
				job.Status = "failed"
				job.Error = err.Error()
				job.Message = "Генерация завершилась с ошибкой"
			})
			return
		}
		h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
			job.Status = "completed"
			job.Percent = 100
			job.Message = "Генерация завершена"
			job.Result = result
		})
	}()

	c.JSON(http.StatusAccepted, gin.H{"job": jobResponse})
}

func (h *ScheduleHandler) StartResetAutoSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule id"})
		return
	}

	generatedByUserID := currentUserID(c)
	job := h.jobs.Create("Пересчёт авто-слотов поставлен в очередь")
	jobResponse := *job

	go func() {
		progress := func(p services.ScheduleGenerationProgress) {
			h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
				job.Percent = p.Percent
				job.Message = p.Message
				job.Strategy = p.Strategy
			})
		}

		result, err := h.generator.ResetAutoScheduleWithProgress(uint(scheduleID), generatedByUserID, progress)
		if err != nil {
			h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
				job.Status = "failed"
				job.Error = err.Error()
				job.Message = "Пересчёт завершился с ошибкой"
			})
			return
		}
		h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
			job.Status = "completed"
			job.Percent = 100
			job.Message = "Пересчёт завершён"
			job.Result = result
		})
	}()

	c.JSON(http.StatusAccepted, gin.H{"job": jobResponse})
}

func (h *ScheduleHandler) GetGenerationJob(c *gin.Context) {
	jobID := strings.TrimSpace(c.Param("jobId"))
	job, ok := h.jobs.Get(jobID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "generation job not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"job": job})
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

	slotType := strings.TrimSpace(req.SlotType)
	if slotType == "" {
		slotType = models.SlotTypeIndividual
	}
	if slotType != models.SlotTypeIndividual && slotType != models.SlotTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slot_type must be individual or group"})
		return
	}

	if req.TeacherID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "teacher_id must be positive"})
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

	slot := models.ScheduleSlot{
		ScheduleID: uint(scheduleID),
		SlotType:   slotType,
		TeacherID:  req.TeacherID,
		RoomName:   strings.TrimSpace(req.RoomName),
		Weekday:    req.Weekday,
		StartTime:  req.StartTime,
		EndTime:    req.EndTime,
		Origin:     models.ScheduleSlotOriginManual,
		Status:     models.ScheduleSlotStatusScheduled,
	}

	if slotType == models.SlotTypeIndividual {
		if req.AssignmentID == 0 || req.StudentID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "assignment_id and student_id must be positive for individual slots"})
			return
		}
		if req.SubjectID == 0 || req.RoomID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subject_id and room_id must be positive for individual slots"})
			return
		}
		if err := h.ensureManualSlotRelations(req.AssignmentID, req.StudentID, req.TeacherID, req.SubjectID, req.RoomID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		subjectID := req.SubjectID
		roomID := req.RoomID
		slot.AssignmentID = &req.AssignmentID
		slot.StudentID = &req.StudentID
		slot.SubjectID = &subjectID
		slot.RoomID = &roomID
	} else {
		if req.GroupLessonID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "group_lesson_id must be positive for group slots"})
			return
		}
		if strings.TrimSpace(req.RoomName) == "" {
			var groupLesson models.GroupLesson
			if err := h.db.First(&groupLesson, req.GroupLessonID).Error; err == nil {
				req.RoomName = groupLesson.RoomName
			}
		}
		if strings.TrimSpace(req.RoomName) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room_name is required for group slots"})
			return
		}
		if err := h.ensureManualGroupSlotRelations(req.GroupLessonID, req.TeacherID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		slot.GroupLessonID = &req.GroupLessonID
	}

	if err := h.ensureSlotHasNoConflicts(slot, 0); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
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
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("Exclusions").
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
		slot.RoomID = req.RoomID
		slot.RoomName = ""
	}
	if strings.TrimSpace(req.RoomName) != "" {
		slot.RoomName = strings.TrimSpace(req.RoomName)
		slot.RoomID = nil
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

	if err := h.ensureSlotHasNoConflicts(slot, slot.ID); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

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
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("Exclusions").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated schedule slot"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot updated successfully",
		"slot":    slot,
	})
}

func (h *ScheduleHandler) PinScheduleSlot(c *gin.Context) {
	h.setScheduleSlotOrigin(c, models.ScheduleSlotOriginManual, "pin")
}

func (h *ScheduleHandler) UnpinScheduleSlot(c *gin.Context) {
	h.setScheduleSlotOrigin(c, models.ScheduleSlotOriginAuto, "unpin")
}

func (h *ScheduleHandler) setScheduleSlotOrigin(c *gin.Context, origin string, action string) {
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

	slot.Origin = origin

	if err := h.db.Save(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to " + action + " schedule slot"})
		return
	}

	if err := h.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("Exclusions").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated schedule slot"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot origin updated successfully",
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
	total := 0

	assignmentOverrides := map[uint]models.AssignmentWeekOverride{}
	var overrides []models.AssignmentWeekOverride
	if err := h.db.Where("week_start_date = ?", schedule.WeekStartDate).Find(&overrides).Error; err == nil {
		for _, o := range overrides {
			assignmentOverrides[o.AssignmentID] = o
		}
	}

	var assignments []models.Assignment
	if err := h.db.Where("status = ?", models.AssignmentStatusActive).Find(&assignments).Error; err == nil {
		for _, a := range assignments {
			if override, ok := assignmentOverrides[a.ID]; ok {
				if override.Status == models.AssignmentStatusPaused {
					continue
				}
				total += override.PlannedVisits
				continue
			}
			total += a.VisitsPerWeek
		}
	}

	groupOverrides := map[uint]models.GroupLessonWeekOverride{}
	var groupWeekOverrides []models.GroupLessonWeekOverride
	if err := h.db.Where("week_start_date = ?", schedule.WeekStartDate).Find(&groupWeekOverrides).Error; err == nil {
		for _, o := range groupWeekOverrides {
			groupOverrides[o.GroupLessonID] = o
		}
	}

	var groupLessons []models.GroupLesson
	if err := h.db.Where("status = ?", models.GroupLessonStatusActive).Find(&groupLessons).Error; err == nil {
		for _, g := range groupLessons {
			if override, ok := groupOverrides[g.ID]; ok {
				if override.Status == models.GroupLessonStatusPaused {
					continue
				}
				if override.PlannedVisits != nil {
					total += *override.PlannedVisits
				} else {
					total += g.VisitsPerWeek
				}
				continue
			}
			total += g.VisitsPerWeek
		}
	}

	return total
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

func (h *ScheduleHandler) ensureSlotHasNoConflicts(slot models.ScheduleSlot, excludeSlotID uint) error {
	if slot.Status == models.ScheduleSlotStatusCancelled {
		return nil
	}

	bufferedStart, bufferedEnd := applyManualBreakBuffer(slot.StartTime, slot.EndTime, services.DefaultBreakMinutes)
	studentIDs, err := h.getSlotStudentIDs(slot)
	if err != nil {
		return err
	}

	var slots []models.ScheduleSlot
	if err := h.db.Where("schedule_id = ?", slot.ScheduleID).Find(&slots).Error; err != nil {
		return fmt.Errorf("failed to load existing slots for conflict check")
	}

	for _, existing := range slots {
		if excludeSlotID != 0 && existing.ID == excludeSlotID {
			continue
		}
		if existing.Weekday != slot.Weekday || existing.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		existingStart, existingEnd := applyManualBreakBuffer(existing.StartTime, existing.EndTime, services.DefaultBreakMinutes)
		if !manualTimesOverlap(bufferedStart, bufferedEnd, existingStart, existingEnd) {
			continue
		}

		if existing.TeacherID == slot.TeacherID {
			return fmt.Errorf("teacher already has a lesson at this time")
		}
		if slot.RoomID != nil && existing.RoomID != nil && *slot.RoomID == *existing.RoomID {
			return fmt.Errorf("room already has a lesson at this time")
		}

		existingStudentIDs, err := h.getSlotStudentIDs(existing)
		if err != nil {
			return err
		}
		if hasAnyStudentIntersection(studentIDs, existingStudentIDs) {
			return fmt.Errorf("student already has a lesson at this time")
		}
	}

	return nil
}

func (h *ScheduleHandler) getSlotStudentIDs(slot models.ScheduleSlot) ([]uint, error) {
	if slot.SlotType == models.SlotTypeGroup {
		if slot.GroupLessonID == nil {
			return nil, nil
		}
		var enrollments []models.GroupLessonEnrollment
		if err := h.db.Where("group_lesson_id = ?", *slot.GroupLessonID).Find(&enrollments).Error; err != nil {
			return nil, fmt.Errorf("failed to load group enrollments for conflict check")
		}
		studentIDs := make([]uint, 0, len(enrollments))
		for _, enrollment := range enrollments {
			studentIDs = append(studentIDs, enrollment.StudentID)
		}
		return studentIDs, nil
	}

	if slot.StudentID == nil {
		return nil, nil
	}
	return []uint{*slot.StudentID}, nil
}

func hasAnyStudentIntersection(left []uint, right []uint) bool {
	if len(left) == 0 || len(right) == 0 {
		return false
	}
	seen := make(map[uint]bool, len(left))
	for _, id := range left {
		seen[id] = true
	}
	for _, id := range right {
		if seen[id] {
			return true
		}
	}
	return false
}

func applyManualBreakBuffer(startTime string, endTime string, breakMin int) (string, string) {
	if breakMin <= 0 {
		return startTime, endTime
	}
	start := manualHHMMToMinutes(startTime)
	end := manualHHMMToMinutes(endTime)
	if start < 0 || end < 0 {
		return startTime, endTime
	}
	start -= breakMin
	if start < 0 {
		start = 0
	}
	end += breakMin
	if end > 23*60+59 {
		end = 23*60 + 59
	}
	return manualMinutesToHHMM(start), manualMinutesToHHMM(end)
}

func manualTimesOverlap(startA, endA, startB, endB string) bool {
	return startA < endB && startB < endA
}

func manualHHMMToMinutes(value string) int {
	if len(value) != 5 || value[2] != ':' {
		return -1
	}
	hour, err := strconv.Atoi(value[:2])
	if err != nil {
		return -1
	}
	minute, err := strconv.Atoi(value[3:])
	if err != nil {
		return -1
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return -1
	}
	return hour*60 + minute
}

func manualMinutesToHHMM(value int) string {
	if value < 0 {
		value = 0
	}
	hour := value / 60
	minute := value % 60
	return fmt.Sprintf("%02d:%02d", hour, minute)
}

func (h *ScheduleHandler) ensureManualGroupSlotRelations(groupLessonID, teacherID uint) error {
	var groupLesson models.GroupLesson
	if err := h.db.First(&groupLesson, groupLessonID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("group lesson not found")
		}
		return err
	}

	if groupLesson.Status != models.GroupLessonStatusActive {
		return fmt.Errorf("group lesson is not active")
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, teacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("teacher not found")
		}
		return err
	}
	if !teacher.IsActive {
		return fmt.Errorf("teacher is not active")
	}

	return nil
}

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
