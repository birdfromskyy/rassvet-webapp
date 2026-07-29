package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"backend/internal/services"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ScheduleHandler struct {
	db                *gorm.DB
	generator         *services.ScheduleGenerator
	jobs              *ScheduleGenerationJobManager
	asyncGenerationMu sync.Mutex
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

func currentUserRole(c *gin.Context) string {
	role, _ := c.Get("role")
	return fmt.Sprint(role)
}

func scheduleGenerationFields(jobID, mode string, actorID uint, actorRole string, result *services.ScheduleResponse, elapsed time.Duration) map[string]any {
	autoSlots, groupAutoSlots := 0, 0
	for _, slot := range result.Slots {
		if slot.Origin == models.ScheduleSlotOriginAuto {
			autoSlots++
			if slot.SlotType == models.SlotTypeGroup {
				groupAutoSlots++
			}
		}
	}
	return map[string]any{
		"generation_id":         jobID,
		"mode":                  mode,
		"actor_id":              actorID,
		"actor_role":            actorRole,
		"schedule_id":           result.Schedule.ID,
		"week_start":            result.Schedule.WeekStartDate,
		"auto_slots_created":    autoSlots,
		"group_auto_slots":      groupAutoSlots,
		"individual_auto_slots": autoSlots - groupAutoSlots,
		"requested":             result.Stats.TotalRequested,
		"scheduled":             result.Stats.Scheduled,
		"unplaced":              result.Stats.Unplaced,
		"issues":                len(result.Issues),
		"duration_ms":           elapsed.Milliseconds(),
	}
}

func scheduleSlotAuditSnapshot(slot models.ScheduleSlot) map[string]any {
	return map[string]any{
		"id":                 slot.ID,
		"schedule_id":        slot.ScheduleID,
		"slot_type":          slot.SlotType,
		"assignment_id":      slot.AssignmentID,
		"group_lesson_id":    slot.GroupLessonID,
		"student_id":         slot.StudentID,
		"teacher_id":         slot.TeacherID,
		"subject_id":         slot.SubjectID,
		"room_id":            slot.RoomID,
		"room_name":          slot.RoomName,
		"weekday":            slot.Weekday,
		"start_time":         slot.StartTime,
		"end_time":           slot.EndTime,
		"origin":             slot.Origin,
		"status":             slot.Status,
		"teacher_hours_mode": slot.TeacherHoursMode,
	}
}

func (h *ScheduleHandler) resolveSlotReportTariff(slot models.ScheduleSlot) (reportTariffMatch, error) {
	lookup, err := loadActiveReportTariffLookup(h.db)
	if err != nil {
		return reportTariffMatch{}, err
	}
	var subjectID *uint
	if slot.SlotType == models.SlotTypeIndividual {
		subjectID = slot.SubjectID
	}
	return resolveReportTariff(lookup, slot.SlotType, subjectID, slotDurationMinutes(slot)), nil
}

func reportTariffMissingMessage(match reportTariffMatch) string {
	typeLabel := "группового"
	if match.SlotType == models.SlotTypeIndividual {
		typeLabel = "индивидуального"
	}
	return fmt.Sprintf("Для %s занятия длительностью %d мин нет активного правила тарификации. В отчётности сумма будет 0 руб.", typeLabel, match.DurationMinutes)
}

func (h *ScheduleHandler) requireReportTariffAcknowledgement(c *gin.Context, slot models.ScheduleSlot, acknowledged bool) (reportTariffMatch, bool) {
	match, err := h.resolveSlotReportTariff(slot)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось проверить правило тарификации"})
		return reportTariffMatch{}, false
	}
	if match.Covered || acknowledged {
		return match, true
	}
	c.JSON(http.StatusUnprocessableEntity, gin.H{
		"code":           "report_tariff_missing",
		"error":          reportTariffMissingMessage(match),
		"tariff_preview": match,
	})
	return match, false
}

func logAcknowledgedMissingReportTariff(c *gin.Context, slot models.ScheduleSlot, match reportTariffMatch) {
	if match.Covered {
		return
	}
	logging.Event("schedule.report_tariff_missing_acknowledged", map[string]any{
		"actor_id":         currentUserID(c),
		"actor_role":       currentUserRole(c),
		"schedule_id":      slot.ScheduleID,
		"slot_id":          slot.ID,
		"slot_type":        slot.SlotType,
		"subject_id":       slot.SubjectID,
		"duration_minutes": match.DurationMinutes,
	})
}

type CreateManualSlotRequest struct {
	SlotType         string `json:"slot_type"`
	AssignmentID     uint   `json:"assignment_id"`
	GroupLessonID    uint   `json:"group_lesson_id"`
	StudentID        uint   `json:"student_id"`
	TeacherID        uint   `json:"teacher_id"`
	TeacherIDs       []uint `json:"teacher_ids"`
	TeacherHoursMode string `json:"teacher_hours_mode"`
	SubjectID        uint   `json:"subject_id"`
	RoomID           uint   `json:"room_id"`
	RoomName         string `json:"room_name"`
	Weekday          int    `json:"weekday" binding:"required"`
	StartTime        string `json:"start_time" binding:"required"`
	EndTime          string `json:"end_time" binding:"required"`
	// A missing reporting tariff does not block a real lesson, but it must be
	// acknowledged explicitly so its zero amount is never accidental.
	AcknowledgeMissingReportTariff bool `json:"acknowledge_missing_report_tariff"`
}

type UpdateScheduleSlotRequest struct {
	RoomID                         *uint   `json:"room_id"`
	Weekday                        *int    `json:"weekday"`
	StartTime                      string  `json:"start_time"`
	EndTime                        string  `json:"end_time"`
	Status                         string  `json:"status"`
	RoomName                       string  `json:"room_name"`
	TeacherIDs                     []uint  `json:"teacher_ids"`
	TeacherHoursMode               *string `json:"teacher_hours_mode"`
	AcknowledgeMissingReportTariff bool    `json:"acknowledge_missing_report_tariff"`
}

// zeroScheduledStudent is a diagnostic row for the weekly schedule screen.
// It intentionally counts only individual slots: group participation is not an
// assignment and must not hide a child whose active assignments got no place.
type zeroScheduledStudent struct {
	StudentID       uint   `json:"student_id"`
	StudentName     string `json:"student_name"`
	Assignments     int    `json:"assignments"`
	RequestedVisits int    `json:"requested_visits"`
	IsResolved      bool   `json:"is_resolved"`
}

func (h *ScheduleHandler) GetScheduleByWeek(c *gin.Context) {
	weekStart := strings.TrimSpace(c.Query("week_start"))
	if weekStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start обязателен"})
		return
	}

	parsedWeekStart, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр week_start должен быть в формате YYYY-MM-DD"})
		return
	}

	var schedule models.Schedule
	if err := h.db.Where("week_start_date = ?", parsedWeekStart).First(&schedule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) GetScheduleByID(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Дата начала недели должна быть в формате YYYY-MM-DD"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Дата начала недели должна быть в формате YYYY-MM-DD"})
		return
	}

	if !h.asyncGenerationMu.TryLock() {
		c.JSON(http.StatusConflict, gin.H{"error": "Генерация или пересчёт расписания уже выполняется"})
		return
	}

	generatedByUserID := currentUserID(c)
	actorRole := currentUserRole(c)
	job := h.jobs.Create("Генерация поставлена в очередь")
	jobResponse := *job
	logging.Event("schedule_generation.started", map[string]any{
		"generation_id": job.ID, "mode": "generate", "actor_id": generatedByUserID,
		"actor_role": actorRole, "week_start": weekStartDate.Format("2006-01-02"),
	})

	go func() {
		defer h.asyncGenerationMu.Unlock()
		startedAt := time.Now()
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
			logging.Event("schedule_generation.failed", map[string]any{
				"generation_id": job.ID, "mode": "generate", "actor_id": generatedByUserID,
				"actor_role": actorRole, "week_start": weekStartDate.Format("2006-01-02"),
				"duration_ms": time.Since(startedAt).Milliseconds(), "error": err.Error(),
			})
			return
		}
		h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
			job.Status = "completed"
			job.Percent = 100
			job.Message = "Генерация завершена"
			job.Result = result
		})
		logging.Event("schedule_generation.completed", scheduleGenerationFields(job.ID, "generate", generatedByUserID, actorRole, result, time.Since(startedAt)))
	}()

	c.JSON(http.StatusAccepted, gin.H{"job": jobResponse})
}

func (h *ScheduleHandler) StartResetAutoSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	if !h.asyncGenerationMu.TryLock() {
		c.JSON(http.StatusConflict, gin.H{"error": "Генерация или пересчёт расписания уже выполняется"})
		return
	}

	generatedByUserID := currentUserID(c)
	actorRole := currentUserRole(c)
	job := h.jobs.Create("Пересчёт авто-слотов поставлен в очередь")
	jobResponse := *job
	logging.Event("schedule_generation.started", map[string]any{
		"generation_id": job.ID, "mode": "reset_auto", "actor_id": generatedByUserID,
		"actor_role": actorRole, "schedule_id": scheduleID,
	})

	go func() {
		defer h.asyncGenerationMu.Unlock()
		startedAt := time.Now()
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
			logging.Event("schedule_generation.failed", map[string]any{
				"generation_id": job.ID, "mode": "reset_auto", "actor_id": generatedByUserID,
				"actor_role": actorRole, "schedule_id": scheduleID,
				"duration_ms": time.Since(startedAt).Milliseconds(), "error": err.Error(),
			})
			return
		}
		h.jobs.Update(job.ID, func(job *ScheduleGenerationJob) {
			job.Status = "completed"
			job.Percent = 100
			job.Message = "Пересчёт завершён"
			job.Result = result
		})
		logging.Event("schedule_generation.completed", scheduleGenerationFields(job.ID, "reset_auto", generatedByUserID, actorRole, result, time.Since(startedAt)))
	}()

	c.JSON(http.StatusAccepted, gin.H{"job": jobResponse})
}

func (h *ScheduleHandler) GetGenerationJob(c *gin.Context) {
	jobID := strings.TrimSpace(c.Param("jobId"))
	job, ok := h.jobs.Get(jobID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Задание на генерацию не найдено"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"job": job})
}

func (h *ScheduleHandler) ApproveSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}
	if err := h.validateScheduleConflicts(uint(scheduleID)); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Расписание содержит конфликт: " + err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось утвердить расписание"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось снять утверждение расписания"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Тип слота должен быть individual или group"})
		return
	}

	if slotType == models.SlotTypeIndividual && req.TeacherID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID преподавателя должен быть положительным числом"})
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

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Для индивидуального слота необходимо указать ID назначения и ученика"})
			return
		}
		if req.SubjectID == 0 || req.RoomID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Для индивидуального слота необходимо указать ID предмета и кабинета"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Для группового слота необходимо указать ID группового занятия"})
			return
		}
		var groupLesson models.GroupLesson
		if err := h.db.Where("archived_at IS NULL").Preload("Teachers").First(&groupLesson, req.GroupLessonID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Групповое занятие не найдено"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось получить групповое занятие"})
			return
		}
		if len(req.TeacherIDs) == 0 {
			for _, link := range groupLesson.Teachers {
				req.TeacherIDs = append(req.TeacherIDs, link.TeacherID)
			}
			if len(req.TeacherIDs) == 0 && groupLesson.DefaultTeacherID != nil {
				req.TeacherIDs = []uint{*groupLesson.DefaultTeacherID}
			}
		}
		if err := h.validateActiveTeacherIDs(req.TeacherIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.TeacherID = req.TeacherIDs[0]
		slot.TeacherID = req.TeacherID
		mode := groupLesson.TeacherHoursMode
		if strings.TrimSpace(req.TeacherHoursMode) != "" {
			mode = strings.TrimSpace(req.TeacherHoursMode)
		}
		if !validTeacherHoursMode(mode) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Режим учёта часов должен быть full или split"})
			return
		}
		slot.TeacherHoursMode = &mode
		if strings.TrimSpace(req.RoomName) == "" {
			req.RoomName = groupLesson.RoomName
		}
		slot.RoomName = strings.TrimSpace(req.RoomName)
		if strings.TrimSpace(req.RoomName) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Для группового слота необходимо указать название кабинета"})
			return
		}
		if err := h.ensureManualGroupSlotRelations(req.GroupLessonID, req.TeacherID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		slot.GroupLessonID = &req.GroupLessonID
	}

	tariffMatch, allowed := h.requireReportTariffAcknowledgement(c, slot, req.AcknowledgeMissingReportTariff)
	if !allowed {
		return
	}

	force := c.Query("force") == "true"
	if !force && slot.SlotType != models.SlotTypeGroup {
		if err := h.ensureSlotHasNoConflicts(slot, 0); err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
	}

	if slot.SlotType == models.SlotTypeGroup && slot.GroupLessonID != nil {
		tx := h.db.Begin()
		if tx.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
			return
		}
		if err := tx.Create(&slot).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
			return
		}
		if err := replaceScheduleSlotTeachers(tx, slot.ID, req.TeacherIDs); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить преподавателей занятия"})
			return
		}
		if !force {
			// The slot is already stored so its teacher snapshot can participate in
			// the query. Exclude this very row; otherwise an empty week conflicts
			// with the just-created slot itself.
			if err := h.ensureSlotHasNoConflictsWithDB(tx, slot, slot.ID); err != nil {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
				return
			}
		}
		if err := h.populateGroupAttendanceWithDB(tx, slot.ID, *slot.GroupLessonID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать состав группы"})
			return
		}
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
			return
		}
	} else if err := h.db.Create(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
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
		Preload("Teachers.Teacher").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	logging.AdminMutation(c, "schedule.slot.create", nil, scheduleSlotAuditSnapshot(slot))
	if req.AcknowledgeMissingReportTariff {
		logAcknowledgedMissingReportTariff(c, slot, tariffMatch)
	}
	c.JSON(http.StatusCreated, gin.H{
		"message": "Manual schedule slot created successfully",
		"slot":    slot,
	})
}

func (h *ScheduleHandler) UpdateScheduleSlot(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Слот расписания не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := scheduleSlotAuditSnapshot(slot)

	if req.RoomID != nil {
		if *req.RoomID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID кабинета должен быть положительным числом"})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "День недели должен быть от 1 до 7"})
			return
		}
		slot.Weekday = *req.Weekday
	}

	durationChanged := req.StartTime != "" || req.EndTime != ""
	if req.StartTime != "" {
		if !isValidTimeHHMM(req.StartTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала должно быть в формате ЧЧ:ММ"})
			return
		}
		slot.StartTime = req.StartTime
	}

	if req.EndTime != "" {
		if !isValidTimeHHMM(req.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Время окончания должно быть в формате ЧЧ:ММ"})
			return
		}
		slot.EndTime = req.EndTime
	}

	if !isStartBeforeEnd(slot.StartTime, slot.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Время начала должно быть раньше времени окончания"})
		return
	}

	var tariffMatch reportTariffMatch
	if durationChanged {
		var allowed bool
		tariffMatch, allowed = h.requireReportTariffAcknowledgement(c, slot, req.AcknowledgeMissingReportTariff)
		if !allowed {
			return
		}
	}

	if strings.TrimSpace(req.Status) != "" {
		switch req.Status {
		case models.ScheduleSlotStatusScheduled, models.ScheduleSlotStatusMoved, models.ScheduleSlotStatusCancelled, models.ScheduleSlotStatusConducted:
			slot.Status = req.Status
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный статус слота"})
			return
		}
	}

	groupTeacherChange := slot.SlotType == models.SlotTypeGroup && req.TeacherIDs != nil
	if groupTeacherChange {
		if err := h.validateActiveTeacherIDs(req.TeacherIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		slot.TeacherID = req.TeacherIDs[0]
	}
	if req.TeacherHoursMode != nil && slot.SlotType == models.SlotTypeGroup {
		if !validTeacherHoursMode(strings.TrimSpace(*req.TeacherHoursMode)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Режим учёта часов доступен только для группы: full или split"})
			return
		}
		mode := strings.TrimSpace(*req.TeacherHoursMode)
		slot.TeacherHoursMode = &mode
	}

	structuralChange := req.RoomID != nil || req.Weekday != nil || req.StartTime != "" || req.EndTime != "" || strings.TrimSpace(req.RoomName) != "" || groupTeacherChange
	if structuralChange {
		slot.Origin = models.ScheduleSlotOriginManual
		// Validate room-subject compatibility when room changes on individual slots
		if req.RoomID != nil && slot.SubjectID != nil && slot.SlotType == models.SlotTypeIndividual {
			var roomSubject models.RoomSubject
			if err := h.db.Where("room_id = ? AND subject_id = ?", *req.RoomID, *slot.SubjectID).First(&roomSubject).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Данный кабинет не предназначен для этого предмета"})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
				return
			}
		}
		force := c.Query("force") == "true"
		if !force && !groupTeacherChange {
			if err := h.ensureSlotHasNoConflicts(slot, slot.ID); err != nil {
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
				return
			}
		}
	}

	if groupTeacherChange {
		tx := h.db.Begin()
		if tx.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
			return
		}
		if err := tx.Save(&slot).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
			return
		}
		if err := replaceScheduleSlotTeachers(tx, slot.ID, req.TeacherIDs); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить преподавателей занятия"})
			return
		}
		if c.Query("force") != "true" {
			if err := h.ensureSlotHasNoConflictsWithDB(tx, slot, slot.ID); err != nil {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
				return
			}
		}
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
			return
		}
	} else if err := h.db.Save(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить запись"})
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
		Preload("Teachers.Teacher").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	logging.AdminMutation(c, "schedule.slot.update", before, scheduleSlotAuditSnapshot(slot))
	if durationChanged && req.AcknowledgeMissingReportTariff {
		logAcknowledgedMissingReportTariff(c, slot, tariffMatch)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).
		First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Слот расписания не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := scheduleSlotAuditSnapshot(slot)

	slot.Origin = origin

	if err := h.db.Save(&slot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера" + action + " schedule slot"})
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
		Preload("Teachers.Teacher").
		First(&slot, slot.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	logging.AdminMutation(c, "schedule.slot."+action, before, scheduleSlotAuditSnapshot(slot))
	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot origin updated successfully",
		"slot":    slot,
	})
}

func (h *ScheduleHandler) DeleteScheduleSlot(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	slotID, err := strconv.Atoi(c.Param("slotId"))
	if err != nil || slotID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID"})
		return
	}

	var slot models.ScheduleSlot
	if err := h.db.Where("id = ? AND schedule_id = ?", slotID, scheduleID).
		First(&slot).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Слот расписания не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	before := scheduleSlotAuditSnapshot(slot)

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		// Existing databases may not have an ON DELETE CASCADE constraint on the
		// newly added teacher snapshot table, so remove dependent rows explicitly.
		if err := tx.Where("schedule_slot_id = ?", slot.ID).Delete(&models.ScheduleSlotTeacher{}).Error; err != nil {
			return err
		}
		if err := tx.Where("schedule_slot_id = ?", slot.ID).Delete(&models.GroupLessonAttendance{}).Error; err != nil {
			return err
		}
		return tx.Delete(&slot).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
		return
	}

	logging.AdminMutation(c, "schedule.slot.delete", before, nil)
	c.JSON(http.StatusOK, gin.H{
		"message": "Schedule slot deleted successfully",
	})
}

func (h *ScheduleHandler) ClearAutoSchedule(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	if err := h.generator.CleanupAutoSlots(schedule.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}
	if err := h.generator.CleanupGenerationIssues(schedule.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

// RefreshDiagnostics recalculates explanations for unscheduled assignments
// without touching any actual lesson in the weekly timetable.
func (h *ScheduleHandler) RefreshDiagnostics(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}
	if err := h.generator.RefreshCurrentDiagnostics(uint(scheduleID)); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить расписание"})
		return
	}
	logging.Event("schedule_diagnostics.refreshed", map[string]any{
		"schedule_id": schedule.ID,
		"actor_id":    currentUserID(c),
		"actor_role":  currentUserRole(c),
	})
	h.respondWithSchedule(c, &schedule)
}

// PATCH /api/admin/schedules/:id/slots/bulk-origin
// Body: { "origin": "manual" | "auto" }
// Sets origin for ALL non-cancelled slots of the schedule.
func (h *ScheduleHandler) BulkUpdateSlotsOrigin(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var body struct {
		Origin string `json:"origin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Origin != string(models.ScheduleSlotOriginManual) && body.Origin != string(models.ScheduleSlotOriginAuto) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "origin должен быть 'manual' или 'auto'"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	if err := h.db.Model(&models.ScheduleSlot{}).
		Where("schedule_id = ? AND status != ?", scheduleID, models.ScheduleSlotStatusCancelled).
		Update("origin", body.Origin).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось обновить происхождение слотов"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) ClearManualSlots(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	var slotIDs []uint
	if err := h.db.Model(&models.ScheduleSlot{}).
		Where("schedule_id = ? AND origin = ?", scheduleID, models.ScheduleSlotOriginManual).
		Pluck("id", &slotIDs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения списка слотов"})
		return
	}

	if len(slotIDs) > 0 {
		if err := h.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("schedule_slot_id IN ?", slotIDs).Delete(&models.ScheduleSlotTeacher{}).Error; err != nil {
				return err
			}
			if err := tx.Where("schedule_slot_id IN ?", slotIDs).Delete(&models.GroupLessonAttendance{}).Error; err != nil {
				return err
			}
			return tx.Where("id IN ?", slotIDs).Delete(&models.ScheduleSlot{}).Error
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить запись"})
			return
		}
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) CreateEmptySchedule(c *gin.Context) {
	var req struct {
		WeekStartDate string `json:"week_start_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	weekStart, err := time.Parse("2006-01-02", req.WeekStartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Дата начала недели должна быть в формате YYYY-MM-DD"})
		return
	}

	var existing models.Schedule
	if err := h.db.Where("week_start_date = ?", weekStart).First(&existing).Error; err == nil {
		h.respondWithSchedule(c, &existing)
		return
	}

	weekEnd := weekStart.AddDate(0, 0, 6)
	schedule := models.Schedule{
		WeekStartDate: weekStart,
		WeekEndDate:   weekEnd,
		Status:        models.ScheduleStatusDraft,
	}
	if err := h.db.Create(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать запись"})
		return
	}

	h.respondWithSchedule(c, &schedule)
}

func (h *ScheduleHandler) CopyManualSlotsFromPrevWeek(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil || scheduleID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID расписания"})
		return
	}

	var schedule models.Schedule
	if err := h.db.First(&schedule, scheduleID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Расписание не найдено"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения расписания"})
		return
	}

	prevWeekStart := schedule.WeekStartDate.AddDate(0, 0, -7)
	var prevSchedule models.Schedule
	if err := h.db.Where("week_start_date = ?", prevWeekStart).First(&prevSchedule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Расписание прошлой недели не найдено"})
		return
	}

	var prevManualSlots []models.ScheduleSlot
	if err := h.db.Where("schedule_id = ? AND origin = ?", prevSchedule.ID, models.ScheduleSlotOriginManual).
		Preload("Teachers").
		Find(&prevManualSlots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}

	if len(prevManualSlots) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Нет ручных слотов в расписании прошлой недели"})
		return
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось начать копирование"})
		return
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	copiedSlots := 0
	for _, s := range prevManualSlots {
		newSlot := models.ScheduleSlot{
			ScheduleID:       schedule.ID,
			SlotType:         s.SlotType,
			AssignmentID:     s.AssignmentID,
			GroupLessonID:    s.GroupLessonID,
			StudentID:        s.StudentID,
			TeacherID:        s.TeacherID,
			SubjectID:        s.SubjectID,
			RoomID:           s.RoomID,
			RoomName:         s.RoomName,
			Weekday:          s.Weekday,
			StartTime:        s.StartTime,
			EndTime:          s.EndTime,
			Origin:           models.ScheduleSlotOriginManual,
			Status:           models.ScheduleSlotStatusScheduled,
			TeacherHoursMode: s.TeacherHoursMode,
		}
		if newSlot.SlotType != models.SlotTypeGroup {
			if err := h.ensureSlotHasNoConflictsWithDB(tx, newSlot, 0); err != nil {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"error": "Нельзя скопировать занятие: " + err.Error()})
				return
			}
		}
		if err := tx.Create(&newSlot).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось скопировать занятия"})
			return
		}
		if newSlot.SlotType == models.SlotTypeGroup && newSlot.GroupLessonID != nil {
			teacherIDs, err := h.getSlotTeacherIDsWithDB(tx, s)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось скопировать преподавателей занятия"})
				return
			}
			if err := replaceScheduleSlotTeachers(tx, newSlot.ID, teacherIDs); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось скопировать преподавателей занятия"})
				return
			}
			// The copied slot is already in the transaction. Exclude it from the
			// comparison; otherwise its own teacher list is reported as a conflict.
			if err := h.ensureSlotHasNoConflictsWithDB(tx, newSlot, newSlot.ID); err != nil {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"error": "Нельзя скопировать занятие: " + err.Error()})
				return
			}
			if err := h.populateGroupAttendanceWithDB(tx, newSlot.ID, *newSlot.GroupLessonID); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось скопировать состав группы"})
				return
			}
		}
		copiedSlots++
	}
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось скопировать занятия"})
		return
	}
	logging.Event("schedule.manual_slots.copy_completed", map[string]any{
		"actor_id": currentUserID(c), "actor_role": currentUserRole(c),
		"source_schedule_id": prevSchedule.ID, "source_week": prevSchedule.WeekStartDate.Format("2006-01-02"),
		"target_schedule_id": schedule.ID, "target_week": schedule.WeekStartDate.Format("2006-01-02"),
		"requested": len(prevManualSlots), "copied": copiedSlots,
	})

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
		Preload("GroupLessonAttendance").
		Preload("GroupLessonAttendance.Student").
		Preload("Teachers.Teacher").
		Where("schedule_id = ?", schedule.ID).
		Order("weekday ASC, start_time ASC, id ASC").
		Find(&slots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения данных"})
		return
	}
	issues = activeIndividualAssignmentIssues(issues)
	h.markResolvedGenerationIssues(issues, slots)

	indRequested, grpRequested := h.countRequestedVisitsFromSchedule(schedule)
	var indScheduled, grpScheduled int
	for _, s := range slots {
		if s.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if s.GroupLessonID != nil {
			grpScheduled++
		} else {
			indScheduled++
		}
	}

	configErrorCodes := map[string]bool{
		models.IssueReasonNoTeacherTime:       true,
		models.IssueReasonNoStudentTime:       true,
		models.IssueReasonNoRoom:              true,
		models.IssueReasonStrictRoomNoSubject: true,
		models.IssueReasonDistributionFailed:  true,
	}
	var configErrors, conflictErrors int
	for _, issue := range issues {
		if issue.ReasonCode == models.IssueReasonNoStudentLessons {
			continue
		}
		if configErrorCodes[issue.ReasonCode] {
			configErrors++
		} else {
			conflictErrors++
		}
	}
	unplaced := len(issues) - countZeroStudentDiagnostics(issues)
	zeroScheduledStudents, err := h.findZeroScheduledStudents(schedule.ID, slots, issues)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось собрать диагностику непроставленных занятий"})
		return
	}

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
		"slots":                   slots,
		"issues":                  issues,
		"zero_scheduled_students": zeroScheduledStudents,
		"stats": gin.H{
			"total_requested": indRequested + grpRequested,
			"ind_requested":   indRequested,
			"grp_requested":   grpRequested,
			"scheduled":       indScheduled,
			"ind_scheduled":   indScheduled,
			"grp_scheduled":   grpScheduled,
			"unplaced":        unplaced,
			"config_errors":   configErrors,
			"conflict_errors": conflictErrors,
		},
	})
}

// activeIndividualAssignmentIssues keeps historical rows in the database, but
// does not present an issue for an assignment that is now paused or whose
// pupil/teacher is paused. These states are intentionally not scheduling
// errors and this filter is response-only: it never changes slots or the
// generator's source data.
func activeIndividualAssignmentIssues(issues []models.ScheduleGenerationIssue) []models.ScheduleGenerationIssue {
	filtered := make([]models.ScheduleGenerationIssue, 0, len(issues))
	for _, issue := range issues {
		if issue.AssignmentID != nil {
			if issue.Assignment == nil || issue.Assignment.ArchivedAt != nil || issue.Assignment.Status != models.AssignmentStatusActive ||
				issue.Student == nil || !issue.Student.IsActive ||
				issue.Teacher == nil || !issue.Teacher.IsActive {
				continue
			}
		}
		filtered = append(filtered, issue)
	}
	return filtered
}

func countZeroStudentDiagnostics(issues []models.ScheduleGenerationIssue) int {
	count := 0
	for _, issue := range issues {
		if issue.ReasonCode == models.IssueReasonNoStudentLessons {
			count++
		}
	}
	return count
}

func (h *ScheduleHandler) findZeroScheduledStudents(scheduleID uint, slots []models.ScheduleSlot, issues []models.ScheduleGenerationIssue) ([]zeroScheduledStudent, error) {
	// New schedules retain this exact post-generation snapshot. Schedules that
	// predate the feature keep the former live diagnostic until regenerated.
	var snapshot []zeroScheduledStudent
	for _, issue := range issues {
		if issue.ReasonCode != models.IssueReasonNoStudentLessons || issue.StudentID == nil {
			continue
		}
		name := fmt.Sprintf("#%d", *issue.StudentID)
		if issue.Student != nil && issue.Student.FullName != "" {
			name = issue.Student.FullName
		}
		snapshot = append(snapshot, zeroScheduledStudent{
			StudentID: *issue.StudentID, StudentName: name,
			Assignments: issue.AssignmentsCount, RequestedVisits: issue.RequestedVisits,
			IsResolved: issue.IsResolved,
		})
	}
	scheduledStudents := make(map[uint]bool)
	for _, slot := range slots {
		if slot.SlotType == models.SlotTypeIndividual && slot.Status != models.ScheduleSlotStatusCancelled && slot.StudentID != nil {
			scheduledStudents[*slot.StudentID] = true
		}
	}

	var assignments []models.Assignment
	if err := h.db.
		Preload("Student").
		Joins("JOIN students ON students.id = assignments.student_id AND students.is_active = true").
		Joins("JOIN teachers ON teachers.id = assignments.teacher_id AND teachers.is_active = true").
		Where("assignments.status = ?", models.AssignmentStatusActive).
		Where("assignments.archived_at IS NULL").
		Order("students.full_name ASC, assignments.id ASC").
		Find(&assignments).Error; err != nil {
		return nil, err
	}

	eligibleStudents := make(map[uint]*zeroScheduledStudent)
	rowsByStudent := make(map[uint]*zeroScheduledStudent)
	for _, assignment := range assignments {
		eligible := eligibleStudents[assignment.StudentID]
		if eligible == nil {
			eligible = &zeroScheduledStudent{StudentID: assignment.StudentID, StudentName: assignment.Student.FullName}
			eligibleStudents[assignment.StudentID] = eligible
		}
		eligible.Assignments++
		eligible.RequestedVisits += assignment.VisitsPerWeek

		if scheduledStudents[assignment.StudentID] {
			continue
		}
		row := rowsByStudent[assignment.StudentID]
		if row == nil {
			row = &zeroScheduledStudent{StudentID: assignment.StudentID, StudentName: assignment.Student.FullName}
			rowsByStudent[assignment.StudentID] = row
		}
		row.Assignments++
		row.RequestedVisits += assignment.VisitsPerWeek
	}

	// Keep the generation snapshot for history, but merge in assignments that
	// appeared afterwards. Otherwise a newly created assignment with no slot
	// would be invisible until the next full generation.
	rowsByID := make(map[uint]zeroScheduledStudent, len(snapshot)+len(rowsByStudent))
	for _, row := range snapshot {
		// A snapshot may predate a pause on the pupil, teacher, or assignment.
		// Do not show it when it is no longer an eligible active assignment.
		eligible := eligibleStudents[row.StudentID]
		if eligible == nil {
			continue
		}
		row.StudentName = eligible.StudentName
		row.Assignments = eligible.Assignments
		row.RequestedVisits = eligible.RequestedVisits
		rowsByID[row.StudentID] = row
	}
	for studentID, row := range rowsByStudent {
		// Current eligible assignments are authoritative: they exclude paused
		// teachers and replace stale counts from an older generation snapshot.
		rowsByID[studentID] = *row
	}

	rows := make([]zeroScheduledStudent, 0, len(rowsByID))
	for _, row := range rowsByID {
		rows = append(rows, row)
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].StudentName < rows[j].StudentName })
	return rows, nil
}

// markResolvedGenerationIssues preserves the generator's original diagnosis
// while reflecting whether later manual work has filled the missing visits.
// It only annotates the response; no issue row or schedule slot is mutated.
func (h *ScheduleHandler) markResolvedGenerationIssues(issues []models.ScheduleGenerationIssue, slots []models.ScheduleSlot) {
	scheduledByAssignment := make(map[uint]int)
	scheduledByGroup := make(map[uint]int)
	scheduledByStudent := make(map[uint]int)
	for _, slot := range slots {
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if slot.AssignmentID != nil {
			scheduledByAssignment[*slot.AssignmentID]++
		}
		if slot.GroupLessonID != nil {
			scheduledByGroup[*slot.GroupLessonID]++
		}
		if slot.SlotType == models.SlotTypeIndividual && slot.StudentID != nil {
			scheduledByStudent[*slot.StudentID]++
		}
	}

	issueCountByAssignment := make(map[uint]int)
	issueCountByGroup := make(map[uint]int)
	for _, issue := range issues {
		if issue.AssignmentID != nil {
			issueCountByAssignment[*issue.AssignmentID]++
		}
		if issue.GroupLessonID != nil {
			issueCountByGroup[*issue.GroupLessonID]++
		}
	}
	resolvedByAssignment := make(map[uint]int)
	resolvedByGroup := make(map[uint]int)
	for index := range issues {
		issue := &issues[index]
		if issue.ReasonCode == models.IssueReasonNoStudentLessons && issue.StudentID != nil {
			issue.IsResolved = scheduledByStudent[*issue.StudentID] > 0
			continue
		}
		if issue.AssignmentID != nil && issue.Assignment != nil {
			baseline := issue.Assignment.VisitsPerWeek - issueCountByAssignment[*issue.AssignmentID]
			resolved := scheduledByAssignment[*issue.AssignmentID] - baseline
			if resolved > resolvedByAssignment[*issue.AssignmentID] && resolved > 0 {
				issue.IsResolved = true
				resolvedByAssignment[*issue.AssignmentID]++
			}
			continue
		}
		if issue.GroupLessonID != nil && issue.GroupLesson != nil {
			baseline := issue.GroupLesson.VisitsPerWeek - issueCountByGroup[*issue.GroupLessonID]
			resolved := scheduledByGroup[*issue.GroupLessonID] - baseline
			if resolved > resolvedByGroup[*issue.GroupLessonID] && resolved > 0 {
				issue.IsResolved = true
				resolvedByGroup[*issue.GroupLessonID]++
			}
		}
	}
}

func (h *ScheduleHandler) countRequestedVisitsFromSchedule(schedule *models.Schedule) (int, int) {
	individual := 0
	group := 0

	var assignments []models.Assignment
	if err := h.db.
		Joins("JOIN students ON students.id = assignments.student_id AND students.is_active = true").
		Joins("JOIN teachers ON teachers.id = assignments.teacher_id AND teachers.is_active = true").
		Where("assignments.status = ?", models.AssignmentStatusActive).
		Where("assignments.archived_at IS NULL").
		Find(&assignments).Error; err == nil {
		for _, a := range assignments {
			individual += a.VisitsPerWeek
		}
	}

	// Group lessons are independent of individual assignments. Count only
	// active, non-archived entries, exactly as the generator does, so the
	// dashboard's requested and placed figures use the same scope.
	var groupLessons []models.GroupLesson
	if err := h.db.
		Where("status = ?", models.GroupLessonStatusActive).
		Where("archived_at IS NULL").
		Find(&groupLessons).Error; err == nil {
		for _, lesson := range groupLessons {
			group += lesson.VisitsPerWeek
		}
	}

	return individual, group
}

func (h *ScheduleHandler) ensureManualSlotRelations(assignmentID, studentID, teacherID, subjectID, roomID uint) error {
	var assignment models.Assignment
	if err := h.db.First(&assignment, assignmentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("Назначение не найдено")
		}
		return err
	}

	if assignment.StudentID != studentID || assignment.TeacherID != teacherID || assignment.SubjectID != subjectID {
		return fmt.Errorf("Назначение не соответствует выбранному ученику, преподавателю или предмету")
	}
	if assignment.ArchivedAt != nil || assignment.Status != models.AssignmentStatusActive {
		return fmt.Errorf("Назначение находится в архиве или на паузе")
	}

	var room models.Room
	if err := h.db.First(&room, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("Кабинет не найден")
		}
		return err
	}
	if room.ArchivedAt != nil || !room.IsActive {
		return fmt.Errorf("Кабинет находится в архиве или неактивен")
	}

	var roomSubject models.RoomSubject
	if err := h.db.Where("room_id = ? AND subject_id = ?", roomID, subjectID).First(&roomSubject).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("Данный кабинет не предназначен для этого предмета")
		}
		return err
	}

	return nil
}

// ========== SLOT EXCLUSIONS (для групповых слотов) ==========

func (h *ScheduleHandler) ensureSlotHasNoConflicts(slot models.ScheduleSlot, excludeSlotID uint) error {
	return h.ensureSlotHasNoConflictsWithDB(h.db, slot, excludeSlotID)
}

// validateScheduleConflicts is deliberately called immediately before approval.
// Draft schedules can be edited by several administrators between client-side
// checks, so approval must not trust a previously loaded browser state.
func (h *ScheduleHandler) validateScheduleConflicts(scheduleID uint) error {
	var slots []models.ScheduleSlot
	if err := h.db.Where("schedule_id = ?", scheduleID).Find(&slots).Error; err != nil {
		return fmt.Errorf("не удалось проверить занятия")
	}
	for _, slot := range slots {
		if err := h.ensureSlotHasNoConflicts(slot, slot.ID); err != nil {
			return err
		}
	}
	return nil
}

func (h *ScheduleHandler) ensureSlotHasNoConflictsWithDB(db *gorm.DB, slot models.ScheduleSlot, excludeSlotID uint) error {
	if slot.Status == models.ScheduleSlotStatusCancelled {
		return nil
	}

	studentIDs, err := h.getSlotStudentIDsWithDB(db, slot)
	if err != nil {
		return err
	}
	teacherIDs, err := h.getSlotTeacherIDsWithDB(db, slot)
	if err != nil {
		return err
	}

	var slots []models.ScheduleSlot
	if err := db.Where("schedule_id = ?", slot.ScheduleID).Find(&slots).Error; err != nil {
		return fmt.Errorf("Не удалось загрузить занятия для проверки конфликтов")
	}

	for _, existing := range slots {
		if excludeSlotID != 0 && existing.ID == excludeSlotID {
			continue
		}
		if existing.Weekday != slot.Weekday || existing.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		if !manualTimesOverlap(slot.StartTime, slot.EndTime, existing.StartTime, existing.EndTime) {
			continue
		}

		existingTeacherIDs, err := h.getSlotTeacherIDsWithDB(db, existing)
		if err != nil {
			return err
		}
		if hasSharedID(teacherIDs, existingTeacherIDs) {
			return fmt.Errorf("У преподавателя уже есть занятие в это время")
		}
		if slot.RoomID != nil && existing.RoomID != nil && *slot.RoomID == *existing.RoomID {
			return fmt.Errorf("Кабинет уже занят в это время")
		}

		existingStudentIDs, err := h.getSlotStudentIDsWithDB(db, existing)
		if err != nil {
			return err
		}
		if hasAnyStudentIntersection(studentIDs, existingStudentIDs) {
			return fmt.Errorf("У ученика уже есть занятие в это время")
		}
	}

	return nil
}

func hasSharedID(left, right []uint) bool {
	seen := make(map[uint]struct{}, len(left))
	for _, id := range left {
		seen[id] = struct{}{}
	}
	for _, id := range right {
		if _, ok := seen[id]; ok {
			return true
		}
	}
	return false
}

// getSlotTeacherIDsWithDB returns the immutable per-slot teacher snapshot for
// groups. The legacy TeacherID remains a fallback so existing schedules stay
// readable until the one-time production data transfer is executed.
func (h *ScheduleHandler) getSlotTeacherIDsWithDB(db *gorm.DB, slot models.ScheduleSlot) ([]uint, error) {
	if slot.SlotType != models.SlotTypeGroup {
		return []uint{slot.TeacherID}, nil
	}
	var links []models.ScheduleSlotTeacher
	if slot.ID != 0 {
		if err := db.Where("schedule_slot_id = ?", slot.ID).Find(&links).Error; err != nil {
			return nil, fmt.Errorf("Не удалось загрузить преподавателей группового занятия для проверки конфликтов")
		}
	}
	if len(links) == 0 {
		return []uint{slot.TeacherID}, nil
	}
	ids := make([]uint, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.TeacherID)
	}
	return ids, nil
}

func replaceScheduleSlotTeachers(db *gorm.DB, slotID uint, ids []uint) error {
	unique, ok := uniquePositiveIDs(ids)
	if !ok {
		return fmt.Errorf("Для группового занятия необходимо указать хотя бы одного преподавателя")
	}
	if err := db.Where("schedule_slot_id = ?", slotID).Delete(&models.ScheduleSlotTeacher{}).Error; err != nil {
		return err
	}
	links := make([]models.ScheduleSlotTeacher, 0, len(unique))
	for _, teacherID := range unique {
		links = append(links, models.ScheduleSlotTeacher{ScheduleSlotID: slotID, TeacherID: teacherID})
	}
	return db.Create(&links).Error
}

func (h *ScheduleHandler) validateActiveTeacherIDs(ids []uint) error {
	unique, ok := uniquePositiveIDs(ids)
	if !ok {
		return fmt.Errorf("У группового занятия должен быть хотя бы один преподаватель")
	}
	var count int64
	if err := h.db.Model(&models.Teacher{}).Where("id IN ? AND is_active = ? AND archived_at IS NULL", unique, true).Count(&count).Error; err != nil {
		return fmt.Errorf("Не удалось проверить преподавателей")
	}
	if count != int64(len(unique)) {
		return fmt.Errorf("Выбран несуществующий или неактивный преподаватель")
	}
	return nil
}

func (h *ScheduleHandler) getSlotStudentIDs(slot models.ScheduleSlot) ([]uint, error) {
	return h.getSlotStudentIDsWithDB(h.db, slot)
}

func (h *ScheduleHandler) getSlotStudentIDsWithDB(db *gorm.DB, slot models.ScheduleSlot) ([]uint, error) {
	if slot.SlotType == models.SlotTypeGroup {
		var attendance []models.GroupLessonAttendance
		if err := db.Where("schedule_slot_id = ?", slot.ID).Find(&attendance).Error; err != nil {
			return nil, fmt.Errorf("Не удалось загрузить состав группового занятия для проверки конфликтов")
		}
		if len(attendance) > 0 {
			studentIDs := make([]uint, 0, len(attendance))
			for _, record := range attendance {
				studentIDs = append(studentIDs, record.StudentID)
			}
			return studentIDs, nil
		}
		if slot.GroupLessonID == nil {
			return nil, nil
		}
		var enrollments []models.GroupLessonEnrollment
		if err := db.Where("group_lesson_id = ?", *slot.GroupLessonID).Find(&enrollments).Error; err != nil {
			return nil, fmt.Errorf("Не удалось загрузить постоянный состав группы для проверки конфликтов")
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

func manualTimesOverlap(startA, endA, startB, endB string) bool {
	return startA < endB && startB < endA
}

func (h *ScheduleHandler) ensureManualGroupSlotRelations(groupLessonID, teacherID uint) error {
	var groupLesson models.GroupLesson
	if err := h.db.First(&groupLesson, groupLessonID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("Групповое занятие не найдено")
		}
		return err
	}

	if groupLesson.Status != models.GroupLessonStatusActive {
		return fmt.Errorf("Групповое занятие приостановлено")
	}
	if groupLesson.ArchivedAt != nil {
		return fmt.Errorf("Групповое занятие находится в архиве")
	}

	var teacher models.Teacher
	if err := h.db.First(&teacher, teacherID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("Преподаватель не найден")
		}
		return err
	}
	if !teacher.IsActive || teacher.ArchivedAt != nil {
		return fmt.Errorf("Преподаватель неактивен")
	}

	return nil
}

func (h *ScheduleHandler) populateGroupAttendance(slotID, groupLessonID uint) {
	_ = h.populateGroupAttendanceWithDB(h.db, slotID, groupLessonID)
}

func (h *ScheduleHandler) populateGroupAttendanceWithDB(db *gorm.DB, slotID, groupLessonID uint) error {
	var enrollments []models.GroupLessonEnrollment
	if err := db.Where("group_lesson_id = ?", groupLessonID).Find(&enrollments).Error; err != nil {
		return err
	}
	for _, e := range enrollments {
		if err := db.Create(&models.GroupLessonAttendance{
			ScheduleSlotID: slotID,
			StudentID:      e.StudentID,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}
