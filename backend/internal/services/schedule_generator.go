package services

import (
	"backend/internal/models"
	"errors"
	"fmt"
	"sort"
	"time"

	"gorm.io/gorm"
)

const DefaultBreakMinutes = 5

type ScheduleGenerator struct {
	db        *gorm.DB
	validator *ScheduleValidator
}

func NewScheduleGenerator(db *gorm.DB) *ScheduleGenerator {
	return &ScheduleGenerator{
		db:        db,
		validator: NewScheduleValidator(),
	}
}

type GenerationContext struct {
	Schedule            models.Schedule
	Assignments         []models.Assignment
	Overrides           []models.AssignmentWeekOverride
	TeacherAvailability []models.TeacherAvailability
	StudentAvailability []models.StudentAvailability
	RoomSubjects        []models.RoomSubject
	ExistingSlots       []models.ScheduleSlot
}

type WeeklyTask struct {
	AssignmentID uint
	StudentID    uint
	TeacherID    uint
	SubjectID    uint

	StudentName   string
	TeacherName   string
	SubjectName   string
	FundingType   string
	VisitsPerWeek int
	DurationMin   int
	TaskIndex     int
}

type CandidateSlot struct {
	AssignmentID uint
	StudentID    uint
	TeacherID    uint
	SubjectID    uint
	RoomID       uint

	Weekday   int
	StartTime string
	EndTime   string

	Score int
}

type ScheduleStats struct {
	TotalRequested int `json:"total_requested"`
	Scheduled      int `json:"scheduled"`
	Unplaced       int `json:"unplaced"`
}

type ScheduleResponse struct {
	Schedule ginScheduleResponse              `json:"schedule"`
	Slots    []models.ScheduleSlot            `json:"slots"`
	Issues   []models.ScheduleGenerationIssue `json:"issues"`
	Stats    ScheduleStats                    `json:"stats"`
}

type ginScheduleResponse struct {
	ID                uint       `json:"id"`
	WeekStartDate     string     `json:"week_start_date"`
	WeekEndDate       string     `json:"week_end_date"`
	Status            string     `json:"status"`
	GeneratedAt       *time.Time `json:"generated_at,omitempty"`
	GeneratedByUserID *uint      `json:"generated_by_user_id,omitempty"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	ApprovedByUserID  *uint      `json:"approved_by_user_id,omitempty"`
}

func (g *ScheduleGenerator) GenerateSchedule(weekStartDate time.Time, generatedByUserID uint) (*ScheduleResponse, error) {
	weekStartDate = normalizeDate(weekStartDate)
	weekEndDate := weekStartDate.AddDate(0, 0, 5)

	schedule, err := g.getOrCreateDraftSchedule(weekStartDate, weekEndDate, generatedByUserID)
	if err != nil {
		return nil, err
	}

	if err := g.CleanupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}

	if err := g.CleanupGenerationIssues(schedule.ID); err != nil {
		return nil, err
	}

	ctx, err := g.LoadGenerationContext(*schedule)
	if err != nil {
		return nil, err
	}

	tasks := g.BuildWeeklyTasks(ctx.Assignments, ctx.Overrides, weekStartDate)
	g.SortTasksByPriority(tasks)

	for _, task := range tasks {
		candidates := g.GetCandidateSlots(task, ctx)

		if len(candidates) == 0 {
			if err := g.SaveGenerationIssue(schedule.ID, task, "NO_CANDIDATE", "Не удалось найти подходящий слот для занятия"); err != nil {
				return nil, err
			}
			continue
		}

		bestCandidate := g.SelectBestCandidate(candidates)

		slot, err := g.SaveGeneratedSlot(schedule.ID, bestCandidate)
		if err != nil {
			return nil, err
		}

		ctx.ExistingSlots = append(ctx.ExistingSlots, *slot)
	}

	now := time.Now()
	schedule.GeneratedAt = &now
	schedule.GeneratedByUserID = &generatedByUserID
	schedule.Status = models.ScheduleStatusDraft

	if err := g.db.Save(schedule).Error; err != nil {
		return nil, fmt.Errorf("failed to update schedule generation metadata: %w", err)
	}

	return g.buildScheduleResponse(schedule.ID)
}

func (g *ScheduleGenerator) ResetAutoSchedule(scheduleID uint, generatedByUserID uint) (*ScheduleResponse, error) {
	var schedule models.Schedule
	if err := g.db.First(&schedule, scheduleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("schedule not found")
		}
		return nil, fmt.Errorf("failed to fetch schedule: %w", err)
	}

	if err := g.CleanupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}

	if err := g.CleanupGenerationIssues(schedule.ID); err != nil {
		return nil, err
	}

	ctx, err := g.LoadGenerationContext(schedule)
	if err != nil {
		return nil, err
	}

	tasks := g.BuildWeeklyTasks(ctx.Assignments, ctx.Overrides, schedule.WeekStartDate)
	g.SortTasksByPriority(tasks)

	for _, task := range tasks {
		candidates := g.GetCandidateSlots(task, ctx)

		if len(candidates) == 0 {
			if err := g.SaveGenerationIssue(schedule.ID, task, "NO_CANDIDATE", "Не удалось найти подходящий слот для занятия"); err != nil {
				return nil, err
			}
			continue
		}

		bestCandidate := g.SelectBestCandidate(candidates)

		slot, err := g.SaveGeneratedSlot(schedule.ID, bestCandidate)
		if err != nil {
			return nil, err
		}

		ctx.ExistingSlots = append(ctx.ExistingSlots, *slot)
	}

	now := time.Now()
	schedule.GeneratedAt = &now
	schedule.GeneratedByUserID = &generatedByUserID
	schedule.Status = models.ScheduleStatusDraft

	if err := g.db.Save(&schedule).Error; err != nil {
		return nil, fmt.Errorf("failed to update schedule metadata: %w", err)
	}

	return g.buildScheduleResponse(schedule.ID)
}

func (g *ScheduleGenerator) LoadGenerationContext(schedule models.Schedule) (*GenerationContext, error) {
	var assignments []models.Assignment
	if err := g.db.
		Preload("Student").
		Preload("Teacher").
		Preload("Subject").
		Joins("JOIN students ON students.id = assignments.student_id AND students.is_active = true").
		Joins("JOIN teachers ON teachers.id = assignments.teacher_id AND teachers.is_active = true").
		Where("assignments.status = ?", models.AssignmentStatusActive).
		Find(&assignments).Error; err != nil {
		return nil, fmt.Errorf("failed to load assignments: %w", err)
	}

	var overrides []models.AssignmentWeekOverride
	if err := g.db.
		Where("week_start_date = ?", schedule.WeekStartDate).
		Find(&overrides).Error; err != nil {
		return nil, fmt.Errorf("failed to load assignment week overrides: %w", err)
	}

	var teacherAvailability []models.TeacherAvailability
	if err := g.db.Find(&teacherAvailability).Error; err != nil {
		return nil, fmt.Errorf("failed to load teacher availability: %w", err)
	}

	var studentAvailability []models.StudentAvailability
	if err := g.db.Find(&studentAvailability).Error; err != nil {
		return nil, fmt.Errorf("failed to load student availability: %w", err)
	}

	var roomSubjects []models.RoomSubject
	if err := g.db.Find(&roomSubjects).Error; err != nil {
		return nil, fmt.Errorf("failed to load room subjects: %w", err)
	}

	var existingSlots []models.ScheduleSlot
	if err := g.db.
		Where("schedule_id = ?", schedule.ID).
		Find(&existingSlots).Error; err != nil {
		return nil, fmt.Errorf("failed to load existing schedule slots: %w", err)
	}

	return &GenerationContext{
		Schedule:            schedule,
		Assignments:         assignments,
		Overrides:           overrides,
		TeacherAvailability: teacherAvailability,
		StudentAvailability: studentAvailability,
		RoomSubjects:        roomSubjects,
		ExistingSlots:       existingSlots,
	}, nil
}

func (g *ScheduleGenerator) ResolveAssignmentParams(
	assignment models.Assignment,
	overrides []models.AssignmentWeekOverride,
	weekStartDate time.Time,
) (int, int, string) {
	visitsPerWeek := assignment.VisitsPerWeek
	durationMin := assignment.DurationMin
	status := assignment.Status

	for _, override := range overrides {
		if override.AssignmentID != assignment.ID {
			continue
		}
		if !sameDate(override.WeekStartDate, weekStartDate) {
			continue
		}

		visitsPerWeek = override.PlannedVisits
		if override.DurationMin != nil {
			durationMin = *override.DurationMin
		}
		status = override.Status
		break
	}

	return visitsPerWeek, durationMin, status
}

func (g *ScheduleGenerator) BuildWeeklyTasks(
	assignments []models.Assignment,
	overrides []models.AssignmentWeekOverride,
	weekStartDate time.Time,
) []WeeklyTask {
	var tasks []WeeklyTask

	for _, assignment := range assignments {
		visitsPerWeek, durationMin, status := g.ResolveAssignmentParams(assignment, overrides, weekStartDate)

		if status != models.AssignmentStatusActive {
			continue
		}

		if visitsPerWeek <= 0 {
			continue
		}

		expanded := g.ExpandTasks(assignment, visitsPerWeek, durationMin)
		tasks = append(tasks, expanded...)
	}

	return tasks
}

func (g *ScheduleGenerator) ExpandTasks(
	assignment models.Assignment,
	visitsPerWeek int,
	durationMin int,
) []WeeklyTask {
	tasks := make([]WeeklyTask, 0, visitsPerWeek)

	for i := 0; i < visitsPerWeek; i++ {
		tasks = append(tasks, WeeklyTask{
			AssignmentID:  assignment.ID,
			StudentID:     assignment.StudentID,
			TeacherID:     assignment.TeacherID,
			SubjectID:     assignment.SubjectID,
			StudentName:   assignment.Student.FullName,
			TeacherName:   assignment.Teacher.FullName,
			SubjectName:   assignment.Subject.Name,
			FundingType:   assignment.Student.FundingType,
			VisitsPerWeek: visitsPerWeek,
			DurationMin:   durationMin,
			TaskIndex:     i + 1,
		})
	}

	return tasks
}

func (g *ScheduleGenerator) SortTasksByPriority(tasks []WeeklyTask) {
	sort.SliceStable(tasks, func(i, j int) bool {
		if tasks[i].FundingType != tasks[j].FundingType {
			return tasks[i].FundingType == models.FundingTypePaid
		}

		if tasks[i].VisitsPerWeek != tasks[j].VisitsPerWeek {
			return tasks[i].VisitsPerWeek > tasks[j].VisitsPerWeek
		}

		if tasks[i].DurationMin != tasks[j].DurationMin {
			return tasks[i].DurationMin > tasks[j].DurationMin
		}

		if tasks[i].TeacherName != tasks[j].TeacherName {
			return tasks[i].TeacherName < tasks[j].TeacherName
		}

		return tasks[i].StudentName < tasks[j].StudentName
	})
}

func (g *ScheduleGenerator) GetCandidateSlots(task WeeklyTask, ctx *GenerationContext) []CandidateSlot {
	var candidates []CandidateSlot

	allowedRoomIDs := g.getAllowedRoomIDs(task.SubjectID, ctx.RoomSubjects)

	if len(allowedRoomIDs) == 0 {
		return candidates
	}

	for weekday := 1; weekday <= 6; weekday++ {
		teacherWindows := g.filterTeacherAvailability(task.TeacherID, weekday, ctx.TeacherAvailability)
		studentWindows := g.filterStudentAvailability(task.StudentID, weekday, ctx.StudentAvailability)

		if len(teacherWindows) == 0 || len(studentWindows) == 0 {
			continue
		}

		for _, teacherWindow := range teacherWindows {
			for _, studentWindow := range studentWindows {
				intersectionStart, intersectionEnd, ok := intersectWindows(
					teacherWindow.StartTime,
					teacherWindow.EndTime,
					studentWindow.StartTime,
					studentWindow.EndTime,
				)
				if !ok {
					continue
				}

				startMinute := hhmmToMinutes(intersectionStart)
				endMinute := hhmmToMinutes(intersectionEnd)

				if startMinute < 0 || endMinute < 0 {
					continue
				}

				for slotStart := startMinute; slotStart+task.DurationMin <= endMinute; slotStart += 5 {
					slotEnd := slotStart + task.DurationMin
					startHHMM := minutesToHHMM(slotStart)
					endHHMM := minutesToHHMM(slotEnd)

					bufferedStart, bufferedEnd := g.validator.ApplyBreakBuffer(startHHMM, endHHMM, DefaultBreakMinutes)

					if !g.validator.IsTeacherAvailable(task.TeacherID, weekday, startHHMM, endHHMM, ctx.TeacherAvailability) {
						continue
					}
					if !g.validator.IsStudentAvailable(task.StudentID, weekday, startHHMM, endHHMM, ctx.StudentAvailability) {
						continue
					}
					if g.validator.ViolatesSameDayRule(task.AssignmentID, weekday, ctx.ExistingSlots) {
						continue
					}
					if g.validator.ViolatesSameSubjectConsecutiveRule(task.StudentID, task.SubjectID, weekday, startHHMM, endHHMM, ctx.ExistingSlots) {
						continue
					}

					for _, roomID := range allowedRoomIDs {
						if !g.validator.IsRoomAllowedForSubject(roomID, task.SubjectID, ctx.RoomSubjects) {
							continue
						}
						if g.validator.HasTeacherConflict(task.TeacherID, weekday, bufferedStart, bufferedEnd, ctx.ExistingSlots) {
							continue
						}
						if g.validator.HasStudentConflict(task.StudentID, weekday, bufferedStart, bufferedEnd, ctx.ExistingSlots) {
							continue
						}
						if g.validator.HasRoomConflict(roomID, weekday, bufferedStart, bufferedEnd, ctx.ExistingSlots) {
							continue
						}

						candidate := CandidateSlot{
							AssignmentID: task.AssignmentID,
							StudentID:    task.StudentID,
							TeacherID:    task.TeacherID,
							SubjectID:    task.SubjectID,
							RoomID:       roomID,
							Weekday:      weekday,
							StartTime:    startHHMM,
							EndTime:      endHHMM,
						}
						candidate.Score = g.ScoreCandidate(candidate, task, ctx)
						candidates = append(candidates, candidate)
					}
				}
			}
		}
	}

	return candidates
}

func (g *ScheduleGenerator) ScoreCandidate(candidate CandidateSlot, task WeeklyTask, ctx *GenerationContext) int {
	score := 0

	// Предпочитаем равномерное распределение по неделе
	if candidate.Weekday == 1 || candidate.Weekday == 3 || candidate.Weekday == 5 {
		score += 10
	}

	// Небольшой бонус за более ранние слоты
	startMin := hhmmToMinutes(candidate.StartTime)
	if startMin >= 0 {
		score += (24*60 - startMin) / 30
	}

	// Бонус, если у преподавателя в этот день уже есть занятия
	// чтобы уменьшать "дырки" между днями и делать расписание более компактным
	for _, slot := range ctx.ExistingSlots {
		if slot.TeacherID == candidate.TeacherID && slot.Weekday == candidate.Weekday {
			score += 15
			break
		}
	}

	// Бонус платным детям
	if task.FundingType == models.FundingTypePaid {
		score += 100
	}

	return score
}

func (g *ScheduleGenerator) SelectBestCandidate(candidates []CandidateSlot) CandidateSlot {
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Score != candidates[j].Score {
			return candidates[i].Score > candidates[j].Score
		}
		if candidates[i].Weekday != candidates[j].Weekday {
			return candidates[i].Weekday < candidates[j].Weekday
		}
		if candidates[i].StartTime != candidates[j].StartTime {
			return candidates[i].StartTime < candidates[j].StartTime
		}
		return candidates[i].RoomID < candidates[j].RoomID
	})

	return candidates[0]
}

func (g *ScheduleGenerator) CleanupAutoSlots(scheduleID uint) error {
	if err := g.db.
		Where("schedule_id = ? AND origin = ?", scheduleID, models.ScheduleSlotOriginAuto).
		Delete(&models.ScheduleSlot{}).Error; err != nil {
		return fmt.Errorf("failed to cleanup auto slots: %w", err)
	}
	return nil
}

func (g *ScheduleGenerator) CleanupGenerationIssues(scheduleID uint) error {
	if err := g.db.
		Where("schedule_id = ?", scheduleID).
		Delete(&models.ScheduleGenerationIssue{}).Error; err != nil {
		return fmt.Errorf("failed to cleanup schedule generation issues: %w", err)
	}
	return nil
}

func (g *ScheduleGenerator) SaveGeneratedSlot(scheduleID uint, candidate CandidateSlot) (*models.ScheduleSlot, error) {
	slot := &models.ScheduleSlot{
		ScheduleID:   scheduleID,
		AssignmentID: candidate.AssignmentID,
		StudentID:    candidate.StudentID,
		TeacherID:    candidate.TeacherID,
		SubjectID:    candidate.SubjectID,
		RoomID:       candidate.RoomID,
		Weekday:      candidate.Weekday,
		StartTime:    candidate.StartTime,
		EndTime:      candidate.EndTime,
		Origin:       models.ScheduleSlotOriginAuto,
		Status:       models.ScheduleSlotStatusScheduled,
	}

	if err := g.db.Create(slot).Error; err != nil {
		return nil, fmt.Errorf("failed to save generated slot: %w", err)
	}

	return slot, nil
}

func (g *ScheduleGenerator) SaveGenerationIssue(scheduleID uint, task WeeklyTask, reasonCode string, message string) error {
	issue := models.ScheduleGenerationIssue{
		ScheduleID:   scheduleID,
		AssignmentID: task.AssignmentID,
		StudentID:    task.StudentID,
		TeacherID:    task.TeacherID,
		SubjectID:    task.SubjectID,
		ReasonCode:   reasonCode,
		Message:      message,
	}

	if err := g.db.Create(&issue).Error; err != nil {
		return fmt.Errorf("failed to save generation issue: %w", err)
	}

	return nil
}

func (g *ScheduleGenerator) CountRequestedVisits(assignments []models.Assignment, overrides []models.AssignmentWeekOverride, weekStartDate time.Time) int {
	total := 0
	for _, assignment := range assignments {
		visits, _, status := g.ResolveAssignmentParams(assignment, overrides, weekStartDate)
		if status != models.AssignmentStatusActive {
			continue
		}
		total += visits
	}
	return total
}

func (g *ScheduleGenerator) getOrCreateDraftSchedule(weekStartDate, weekEndDate time.Time, generatedByUserID uint) (*models.Schedule, error) {
	var schedule models.Schedule
	err := g.db.Where("week_start_date = ?", weekStartDate).First(&schedule).Error
	if err == nil {
		return &schedule, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to fetch schedule: %w", err)
	}

	now := time.Now()

	schedule = models.Schedule{
		WeekStartDate:     weekStartDate,
		WeekEndDate:       weekEndDate,
		Status:            models.ScheduleStatusDraft,
		GeneratedAt:       &now,
		GeneratedByUserID: &generatedByUserID,
	}

	if err := g.db.Create(&schedule).Error; err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	return &schedule, nil
}

func (g *ScheduleGenerator) buildScheduleResponse(scheduleID uint) (*ScheduleResponse, error) {
	var schedule models.Schedule
	if err := g.db.First(&schedule, scheduleID).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch schedule: %w", err)
	}

	var slots []models.ScheduleSlot
	if err := g.db.
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Room").
		Preload("Assignment").
		Where("schedule_id = ?", schedule.ID).
		Order("weekday ASC, start_time ASC, id ASC").
		Find(&slots).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch schedule slots: %w", err)
	}

	var issues []models.ScheduleGenerationIssue
	if err := g.db.
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Assignment").
		Where("schedule_id = ?", schedule.ID).
		Order("id ASC").
		Find(&issues).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch schedule generation issues: %w", err)
	}

	var assignments []models.Assignment
	if err := g.db.Where("status = ?", models.AssignmentStatusActive).Find(&assignments).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch assignments for stats: %w", err)
	}

	var overrides []models.AssignmentWeekOverride
	if err := g.db.Where("week_start_date = ?", schedule.WeekStartDate).Find(&overrides).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch overrides for stats: %w", err)
	}

	totalRequested := g.CountRequestedVisits(assignments, overrides, schedule.WeekStartDate)

	return &ScheduleResponse{
		Schedule: ginScheduleResponse{
			ID:                schedule.ID,
			WeekStartDate:     schedule.WeekStartDate.Format("2006-01-02"),
			WeekEndDate:       schedule.WeekEndDate.Format("2006-01-02"),
			Status:            schedule.Status,
			GeneratedAt:       schedule.GeneratedAt,
			GeneratedByUserID: schedule.GeneratedByUserID,
			ApprovedAt:        schedule.ApprovedAt,
			ApprovedByUserID:  schedule.ApprovedByUserID,
		},
		Slots:  slots,
		Issues: issues,
		Stats: ScheduleStats{
			TotalRequested: totalRequested,
			Scheduled:      len(slots),
			Unplaced:       len(issues),
		},
	}, nil
}

func (g *ScheduleGenerator) getAllowedRoomIDs(subjectID uint, roomSubjects []models.RoomSubject) []uint {
	roomSet := make(map[uint]struct{})
	for _, rs := range roomSubjects {
		if rs.SubjectID == subjectID {
			roomSet[rs.RoomID] = struct{}{}
		}
	}

	result := make([]uint, 0, len(roomSet))
	for roomID := range roomSet {
		result = append(result, roomID)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })

	return result
}

func (g *ScheduleGenerator) filterTeacherAvailability(
	teacherID uint,
	weekday int,
	availability []models.TeacherAvailability,
) []models.TeacherAvailability {
	result := make([]models.TeacherAvailability, 0)
	for _, a := range availability {
		if a.TeacherID == teacherID && a.Weekday == weekday {
			result = append(result, a)
		}
	}
	return result
}

func (g *ScheduleGenerator) filterStudentAvailability(
	studentID uint,
	weekday int,
	availability []models.StudentAvailability,
) []models.StudentAvailability {
	result := make([]models.StudentAvailability, 0)
	for _, a := range availability {
		if a.StudentID == studentID && a.Weekday == weekday {
			result = append(result, a)
		}
	}
	return result
}

func intersectWindows(startA, endA, startB, endB string) (string, string, bool) {
	start := startA
	if startB > start {
		start = startB
	}

	end := endA
	if endB < end {
		end = endB
	}

	if start >= end {
		return "", "", false
	}

	return start, end, true
}

func normalizeDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func sameDate(a, b time.Time) bool {
	return a.Year() == b.Year() &&
		a.Month() == b.Month() &&
		a.Day() == b.Day()
}
