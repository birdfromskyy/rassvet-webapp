package services

import (
	"backend/internal/models"
	"errors"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

const DefaultBreakMinutes = 0
const IdealStudentGapMinutes = 10
const MaxStudentGapMinutes = 30
const TeacherGapMinutes = 10
const MaxRepairSwapSlots = 4
const EarlyStopUnplacedLessons = 5
const MaxScheduleStrategies = 7

type ScheduleGenerator struct {
	db                   *gorm.DB
	validator            *ScheduleValidator
	maxStudentGapMinutes int
	teacherGapMinutes    int
}

func NewScheduleGenerator(db *gorm.DB) *ScheduleGenerator {
	return &ScheduleGenerator{
		db:                   db,
		validator:            NewScheduleValidator(),
		maxStudentGapMinutes: MaxStudentGapMinutes,
		teacherGapMinutes:    TeacherGapMinutes,
	}
}

func (g *ScheduleGenerator) loadSettings() {
	readInt := func(key string, def int) int {
		var s struct{ Value string }
		if err := g.db.Raw("SELECT value FROM site_settings WHERE key = ? LIMIT 1", key).Scan(&s).Error; err == nil && s.Value != "" {
			if v, err := strconv.Atoi(s.Value); err == nil && v > 0 {
				log.Printf("[GEN] loadSettings: key=%q db_value=%q → %d", key, s.Value, v)
				return v
			}
			log.Printf("[GEN] loadSettings: key=%q db_value=%q invalid, using default=%d", key, s.Value, def)
		} else {
			log.Printf("[GEN] loadSettings: key=%q not found in DB, using default=%d", key, def)
		}
		return def
	}
	g.maxStudentGapMinutes = readInt("max_student_gap_minutes", MaxStudentGapMinutes)
	g.teacherGapMinutes = readInt("teacher_gap_minutes", TeacherGapMinutes)
	log.Printf("[GEN] loadSettings RESULT: maxStudentGap=%d teacherGap=%d", g.maxStudentGapMinutes, g.teacherGapMinutes)
}

type gapCombo struct {
	studentGap int
	teacherGap int
}

func buildGapValues(max int) []int {
	if max <= 5 {
		return []int{max}
	}
	var values []int
	for v := 5; v < max; v += 5 {
		values = append(values, v)
	}
	return append(values, max)
}

// buildGapCombinations returns all (student_gap, teacher_gap) pairs to try
// during the multi-run phase. Returns a single entry when both maxima are ≤ 5.
func (g *ScheduleGenerator) buildGapCombinations() []gapCombo {
	sg := buildGapValues(g.maxStudentGapMinutes)
	tg := buildGapValues(g.teacherGapMinutes)
	combos := make([]gapCombo, 0, len(sg)*len(tg))
	for _, s := range sg {
		for _, t := range tg {
			combos = append(combos, gapCombo{s, t})
		}
	}
	return combos
}

type teacherStudentKey struct {
	TeacherID, StudentID uint
}

type GenerationContext struct {
	Schedule                models.Schedule
	Assignments             []models.Assignment
	TeacherAvailability     []models.TeacherAvailability
	StudentAvailability     []models.StudentAvailability
	RoomSubjects            []models.RoomSubject
	TeacherRooms            []models.TeacherRoom
	GroupLessons            []models.GroupLesson
	GroupLessonEnrollments  []models.GroupLessonEnrollment
	ExistingSlots           []models.ScheduleSlot
	StrictTeacherRoomMap    map[uint][]uint       // teacherID -> []roomID (строгие)
	PreferredTeacherRoomMap map[uint][]uint       // teacherID -> []roomID (предпочтительные)
	StrictTeacherIDs        map[uint]bool         // teacherID -> true если есть хоть один строгий кабинет
	WindowMinutesCache      map[teacherStudentKey]int // кэш пересечений окон teacher+student
}

type WeeklyTask struct {
	AssignmentID uint
	StudentID    uint
	TeacherID    uint
	SubjectID    uint

	StudentName            string
	TeacherName            string
	SubjectName            string
	FundingType            string
	VisitsPerWeek          int
	DurationMin            int
	TaskIndex              int
	HasStrictRoom          bool
	AvailableWindowMinutes int // total intersection of teacher+student windows across all weekdays
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

type ScheduleGenerationProgress struct {
	Percent  int    `json:"percent"`
	Message  string `json:"message"`
	Strategy string `json:"strategy,omitempty"`
}

type ScheduleGenerationProgressFunc func(ScheduleGenerationProgress)

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

type ScheduleStrategy struct {
	Name            string
	IndividualOrder string
}

type generationRunResult struct {
	Strategy       ScheduleStrategy
	UnplacedTasks  []WeeklyTask
	AutoSlots      []models.ScheduleSlot
	ScheduledCount int
	QualityScore   int
}

func reportGenerationProgress(progress ScheduleGenerationProgressFunc, percent int, message string, strategy string) {
	if progress == nil {
		return
	}
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	progress(ScheduleGenerationProgress{
		Percent:  percent,
		Message:  message,
		Strategy: strategy,
	})
}

func (g *ScheduleGenerator) GenerateSchedule(weekStartDate time.Time, generatedByUserID uint) (*ScheduleResponse, error) {
	return g.GenerateScheduleWithProgress(weekStartDate, generatedByUserID, nil)
}

func (g *ScheduleGenerator) GenerateScheduleWithProgress(
	weekStartDate time.Time,
	generatedByUserID uint,
	progress ScheduleGenerationProgressFunc,
) (*ScheduleResponse, error) {
	g.loadSettings()
	reportGenerationProgress(progress, 1,
		fmt.Sprintf("Настройки: окно ученика %d мин, перерыв преподавателя %d мин", g.maxStudentGapMinutes, g.teacherGapMinutes),
		"settings")
	weekStartDate = normalizeDate(weekStartDate)
	weekEndDate := weekStartDate.AddDate(0, 0, 5)

	schedule, err := g.getOrCreateDraftSchedule(weekStartDate, weekEndDate, generatedByUserID)
	if err != nil {
		return nil, err
	}

	if err := g.BackupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.CleanupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.CleanupGenerationIssues(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.GenerateBestAutoSchedule(schedule, progress); err != nil {
		return nil, err
	}

	reportGenerationProgress(progress, 98, "Сохранение результата", "")
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
	return g.ResetAutoScheduleWithProgress(scheduleID, generatedByUserID, nil)
}

func (g *ScheduleGenerator) ResetAutoScheduleWithProgress(
	scheduleID uint,
	generatedByUserID uint,
	progress ScheduleGenerationProgressFunc,
) (*ScheduleResponse, error) {
	g.loadSettings()
	reportGenerationProgress(progress, 1,
		fmt.Sprintf("Настройки: окно ученика %d мин, перерыв преподавателя %d мин", g.maxStudentGapMinutes, g.teacherGapMinutes),
		"settings")
	var schedule models.Schedule
	if err := g.db.First(&schedule, scheduleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("schedule not found")
		}
		return nil, fmt.Errorf("failed to fetch schedule: %w", err)
	}

	if err := g.BackupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.CleanupAutoSlots(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.CleanupGenerationIssues(schedule.ID); err != nil {
		return nil, err
	}
	if err := g.GenerateBestAutoSchedule(&schedule, progress); err != nil {
		return nil, err
	}

	reportGenerationProgress(progress, 98, "Сохранение результата", "")
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

	var teacherRooms []models.TeacherRoom
	if err := g.db.Find(&teacherRooms).Error; err != nil {
		return nil, fmt.Errorf("failed to load teacher rooms: %w", err)
	}

	var groupLessons []models.GroupLesson
	if err := g.db.
		Joins("JOIN teachers ON teachers.id = COALESCE(group_lessons.default_teacher_id, 0) AND teachers.is_active = true OR group_lessons.default_teacher_id IS NULL").
		Where("group_lessons.status = ?", models.GroupLessonStatusActive).
		Find(&groupLessons).Error; err != nil {
		// Fallback: simple query without teacher join
		if err2 := g.db.Where("status = ?", models.GroupLessonStatusActive).Find(&groupLessons).Error; err2 != nil {
			return nil, fmt.Errorf("failed to load group lessons: %w", err2)
		}
	}

	var groupEnrollments []models.GroupLessonEnrollment
	if err := g.db.
		Joins("JOIN students ON students.id = group_lesson_enrollments.student_id AND students.is_active = true").
		Find(&groupEnrollments).Error; err != nil {
		return nil, fmt.Errorf("failed to load group lesson enrollments: %w", err)
	}

	var existingSlots []models.ScheduleSlot
	if err := g.db.Where("schedule_id = ?", schedule.ID).Preload("GroupLesson").Find(&existingSlots).Error; err != nil {
		return nil, fmt.Errorf("failed to load existing schedule slots: %w", err)
	}

	// Строим карты кабинетов преподавателей
	strictMap := make(map[uint][]uint)
	preferredMap := make(map[uint][]uint)
	strictTeacherIDs := make(map[uint]bool)

	for _, tr := range teacherRooms {
		if tr.IsStrict {
			strictMap[tr.TeacherID] = append(strictMap[tr.TeacherID], tr.RoomID)
			strictTeacherIDs[tr.TeacherID] = true
		} else {
			preferredMap[tr.TeacherID] = append(preferredMap[tr.TeacherID], tr.RoomID)
		}
	}

	return &GenerationContext{
		Schedule:                schedule,
		Assignments:             assignments,
		TeacherAvailability:     teacherAvailability,
		StudentAvailability:     studentAvailability,
		RoomSubjects:            roomSubjects,
		TeacherRooms:            teacherRooms,
		GroupLessons:            groupLessons,
		GroupLessonEnrollments:  groupEnrollments,
		ExistingSlots:           existingSlots,
		StrictTeacherRoomMap:    strictMap,
		PreferredTeacherRoomMap: preferredMap,
		StrictTeacherIDs:        strictTeacherIDs,
		WindowMinutesCache:      make(map[teacherStudentKey]int),
	}, nil
}

func (g *ScheduleGenerator) GenerateBestAutoSchedule(schedule *models.Schedule, progress ScheduleGenerationProgressFunc) error {
	// Phase 1: combinatorial scan — try all (student_gap × teacher_gap) pairs
	// using the default strategy, pick the combination that places the most lessons.
	combos := g.buildGapCombinations()
	multiRun := len(combos) > 1
	bestCombo := combos[len(combos)-1] // default: the user-configured max values
	// Save user-configured max values — Phase 2 must always run with these,
	// not with Phase 1's winning combo which may be more restrictive.
	originalStudentGap := g.maxStudentGapMinutes
	originalTeacherGap := g.teacherGapMinutes

	log.Printf("[GEN] GenerateBestAutoSchedule START: scheduleID=%d originalStudentGap=%d originalTeacherGap=%d combos=%d multiRun=%v",
		schedule.ID, originalStudentGap, originalTeacherGap, len(combos), multiRun)
	for i, c := range combos {
		log.Printf("[GEN]   combo[%d]: studentGap=%d teacherGap=%d", i, c.studentGap, c.teacherGap)
	}

	var bestPhase1Result *generationRunResult
	if multiRun {
		bestCount := -1
		defaultStrategy := g.scheduleStrategies()[0]
		for i, combo := range combos {
			g.maxStudentGapMinutes = combo.studentGap
			g.teacherGapMinutes = combo.teacherGap
			if err := g.CleanupAutoSlots(schedule.ID); err != nil {
				return err
			}
			ctx, err := g.LoadGenerationContext(*schedule)
			if err != nil {
				return err
			}
			result, err := g.RunGenerationStrategy(schedule.ID, ctx, defaultStrategy)
			if err != nil {
				return err
			}
			isBest := result.ScheduledCount > bestCount
			log.Printf("[GEN] Phase1 combo[%d] studentGap=%d teacherGap=%d → scheduled=%d qualityScore=%d isBestSoFar=%v",
				i, combo.studentGap, combo.teacherGap, result.ScheduledCount, result.QualityScore, isBest)
			if isBest {
				bestCount = result.ScheduledCount
				bestCombo = combo
				copyResult := result
				bestPhase1Result = &copyResult
			}
			percent := 5 + (i+1)*40/len(combos)
			reportGenerationProgress(progress, percent,
				fmt.Sprintf("Поиск: окно %d/%d мин → %d занятий", combo.studentGap, combo.teacherGap, result.ScheduledCount), "scan")
		}
		// Restore the user's configured max constraints for Phase 2.
		// Phase 1 found a baseline result; Phase 2 must run with the full
		// allowed gaps so it is not artificially restricted.
		g.maxStudentGapMinutes = originalStudentGap
		g.teacherGapMinutes = originalTeacherGap

		phase1AutoSlotsCount := 0
		if bestPhase1Result != nil {
			phase1AutoSlotsCount = len(bestPhase1Result.AutoSlots)
		}
		log.Printf("[GEN] Phase1 DONE: bestCombo=(%d,%d) bestCount=%d phase1AutoSlots=%d; RESTORED gaps to studentGap=%d teacherGap=%d",
			bestCombo.studentGap, bestCombo.teacherGap, bestCount, phase1AutoSlotsCount, g.maxStudentGapMinutes, g.teacherGapMinutes)
		if bestPhase1Result != nil {
			log.Printf("[GEN] Phase1 bestResult: strategy=%q scheduledCount=%d qualityScore=%d unplaced=%d autoSlots=%d",
				bestPhase1Result.Strategy.Name, bestPhase1Result.ScheduledCount, bestPhase1Result.QualityScore,
				len(bestPhase1Result.UnplacedTasks), len(bestPhase1Result.AutoSlots))
		}

		reportGenerationProgress(progress, 45,
			fmt.Sprintf("Лучшее в поиске: окно %d/%d мин (%d занятий)", bestCombo.studentGap, bestCombo.teacherGap, bestCount), "scan")
	}

	// Phase 2: run ALL Phase 1 combos × all strategies to find the global optimum.
	// This guarantees that (10,15) settings can't do worse than (10,10), because
	// (10,10) is one of the Phase 1 combos and will be tested with every strategy.
	strategies := g.scheduleStrategies()
	best := bestPhase1Result
	strategyCount := len(strategies)
	if strategyCount > MaxScheduleStrategies {
		strategyCount = MaxScheduleStrategies
	}

	// In single-combo mode there is nothing to iterate over — just use originalGap.
	phase2Combos := []gapCombo{{originalStudentGap, originalTeacherGap}}
	if multiRun {
		phase2Combos = combos
	}
	totalRuns := len(phase2Combos) * strategyCount

	log.Printf("[GEN] Phase2 START: phase2Combos=%d strategies=%d totalRuns=%d baseline=%v",
		len(phase2Combos), strategyCount, totalRuns, bestPhase1Result != nil)
	if best != nil {
		log.Printf("[GEN] Phase2 baseline (Phase1 best): scheduled=%d qualityScore=%d", best.ScheduledCount, best.QualityScore)
	}

	phase2Start := 5
	if multiRun {
		phase2Start = 48
	}
	runIndex := 0

	for _, phase2Combo := range phase2Combos {
		g.maxStudentGapMinutes = phase2Combo.studentGap
		g.teacherGapMinutes = phase2Combo.teacherGap

		for index, strategy := range strategies {
			if index >= MaxScheduleStrategies {
				break
			}
			runIndex++
			startPercent := phase2Start + (runIndex-1)*(85-phase2Start)/totalRuns
			finishPercent := phase2Start + runIndex*(85-phase2Start)/totalRuns
			reportGenerationProgress(progress, startPercent,
				fmt.Sprintf("Стратегия %q (окно %d/%d)", strategy.Name, phase2Combo.studentGap, phase2Combo.teacherGap),
				strategy.Name)
			if err := g.CleanupAutoSlots(schedule.ID); err != nil {
				return err
			}

			ctx, err := g.LoadGenerationContext(*schedule)
			if err != nil {
				return err
			}

			result, err := g.RunGenerationStrategy(schedule.ID, ctx, strategy)
			if err != nil {
				return err
			}
			isNewBest := best == nil || result.QualityScore > best.QualityScore
			if best != nil {
				log.Printf("[GEN] Phase2 combo(%d,%d) strategy[%d]=%q scheduled=%d qs=%d | best: scheduled=%d qs=%d | isNewBest=%v",
					phase2Combo.studentGap, phase2Combo.teacherGap,
					index, strategy.Name, result.ScheduledCount, result.QualityScore,
					best.ScheduledCount, best.QualityScore, isNewBest)
			} else {
				log.Printf("[GEN] Phase2 combo(%d,%d) strategy[%d]=%q scheduled=%d qs=%d | no baseline → isNewBest=true",
					phase2Combo.studentGap, phase2Combo.teacherGap,
					index, strategy.Name, result.ScheduledCount, result.QualityScore)
			}
			if isNewBest {
				copyResult := result
				best = &copyResult
			}
			reportGenerationProgress(
				progress,
				finishPercent,
				fmt.Sprintf("Стратегия %q (окно %d/%d): %d занятий", strategy.Name, phase2Combo.studentGap, phase2Combo.teacherGap, result.ScheduledCount),
				strategy.Name,
			)
			if isNewBest && len(result.UnplacedTasks) <= EarlyStopUnplacedLessons {
				log.Printf("[GEN] Phase2 early stop at combo(%d,%d) strategy[%d]=%q (unplaced=%d ≤ %d, isNewBest=true)",
					phase2Combo.studentGap, phase2Combo.teacherGap,
					index, strategy.Name, len(result.UnplacedTasks), EarlyStopUnplacedLessons)
				break
			}
		}
	}

	// Restore user-configured original gaps.
	g.maxStudentGapMinutes = originalStudentGap
	g.teacherGapMinutes = originalTeacherGap

	if best == nil {
		log.Printf("[GEN] best is nil after all phases — nothing to restore")
		return nil
	}

	log.Printf("[GEN] FINAL best: strategy=%q scheduledCount=%d qualityScore=%d unplaced=%d autoSlots=%d",
		best.Strategy.Name, best.ScheduledCount, best.QualityScore, len(best.UnplacedTasks), len(best.AutoSlots))

	reportGenerationProgress(progress, 88, "Восстановление лучшего варианта", best.Strategy.Name)
	if err := g.CleanupAutoSlots(schedule.ID); err != nil {
		return err
	}
	if err := g.CleanupGenerationIssues(schedule.ID); err != nil {
		return err
	}
	if err := g.RestoreAutoSlots(best.AutoSlots); err != nil {
		return err
	}
	log.Printf("[GEN] RestoreAutoSlots done: restored %d slots", len(best.AutoSlots))

	reportGenerationProgress(progress, 91, "Финальный ремонт нераспределённых занятий", best.Strategy.Name)
	ctx, err := g.LoadGenerationContext(*schedule)
	if err != nil {
		return err
	}
	var repairErr error
	best.UnplacedTasks, repairErr = g.RepairWeeklyTasksWithSwaps(schedule.ID, best.UnplacedTasks, ctx)
	if repairErr != nil {
		return repairErr
	}
	log.Printf("[GEN] Final repair done: remaining unplaced=%d", len(best.UnplacedTasks))

	reportGenerationProgress(progress, 94, "Формирование списка непроставленных занятий", best.Strategy.Name)
	for _, task := range best.UnplacedTasks {
		if err := g.SaveGenerationIssue(schedule.ID, task, "NO_CANDIDATE", g.DiagnoseNoCandidates(task, ctx)); err != nil {
			return err
		}
	}

	return nil
}

func (g *ScheduleGenerator) RunGenerationStrategy(
	scheduleID uint,
	ctx *GenerationContext,
	strategy ScheduleStrategy,
) (generationRunResult, error) {
	tasks := g.BuildWeeklyTasks(ctx.Assignments, ctx)
	g.SortTasksByStrategy(tasks, strategy.IndividualOrder)

	unplacedTasks, err := g.runIndividualTaskPipeline(scheduleID, tasks, ctx)
	if err != nil {
		return generationRunResult{}, err
	}

	scheduledCount := g.countScheduledSlots(ctx.ExistingSlots)
	autoSlots := g.copyAutoSlots(ctx.ExistingSlots)
	return generationRunResult{
		Strategy:      strategy,
		UnplacedTasks: unplacedTasks,
		AutoSlots:     autoSlots,
		ScheduledCount: scheduledCount,
		QualityScore:  g.scoreGeneratedSchedule(ctx, scheduledCount, len(unplacedTasks)),
	}, nil
}

func (g *ScheduleGenerator) runIndividualTaskPipeline(
	scheduleID uint,
	tasks []WeeklyTask,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	unplacedTasks, err := g.PlaceWeeklyTasks(scheduleID, tasks, ctx)
	if err != nil {
		return nil, err
	}
	return g.RepairWeeklyTasksWithSwaps(scheduleID, unplacedTasks, ctx)
}

func (g *ScheduleGenerator) scheduleStrategies() []ScheduleStrategy {
	return []ScheduleStrategy{
		{Name: "default", IndividualOrder: "default"},
		{Name: "teacher-blocks", IndividualOrder: "teacher_blocks"},
		{Name: "no-availability-priority", IndividualOrder: "no_availability"},
		{Name: "student-blocks", IndividualOrder: "student_blocks"},
		{Name: "high-visits-first", IndividualOrder: "visits_first"},
		{Name: "long-duration-first", IndividualOrder: "duration_first"},
		{Name: "broad-availability-first", IndividualOrder: "broad_availability"},
	}
}

func (g *ScheduleGenerator) PlaceWeeklyTasks(
	scheduleID uint,
	tasks []WeeklyTask,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	unplaced := make([]WeeklyTask, 0)

	for _, task := range tasks {
		candidates := g.GetCandidateSlots(task, ctx)
		if len(candidates) == 0 {
			unplaced = append(unplaced, task)
			continue
		}

		bestCandidate := g.SelectBestCandidate(candidates)
		slot, err := g.SaveGeneratedSlot(scheduleID, bestCandidate)
		if err != nil {
			return nil, err
		}
		ctx.ExistingSlots = append(ctx.ExistingSlots, *slot)
	}

	return unplaced, nil
}

func (g *ScheduleGenerator) RepairWeeklyTasksWithSwaps(
	scheduleID uint,
	tasks []WeeklyTask,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	remaining := make([]WeeklyTask, 0)

	for _, task := range tasks {
		repaired, err := g.tryRepairWeeklyTaskWithSwap(scheduleID, task, ctx)
		if err != nil {
			return nil, err
		}
		if !repaired {
			remaining = append(remaining, task)
		}
	}

	return remaining, nil
}

func (g *ScheduleGenerator) tryRepairWeeklyTaskWithSwap(
	scheduleID uint,
	task WeeklyTask,
	ctx *GenerationContext,
) (bool, error) {
	bestWeekday := -1
	bestScore := 0

	// Explore all weekdays, track the one that produces the best quality score.
	for weekday := 1; weekday <= 7; weekday++ {
		removedSlots := g.collectRepairSwapSlots(task, weekday, ctx)
		if len(removedSlots) == 0 {
			continue
		}

		removedTasks := g.weeklyTasksFromSlots(removedSlots, ctx)
		if len(removedTasks) != len(removedSlots) {
			continue
		}

		if err := g.deleteSlotsForRepair(removedSlots); err != nil {
			return false, err
		}
		g.removeSlotsFromContext(removedSlots, ctx)

		attemptTasks := make([]WeeklyTask, 0, len(removedTasks)+1)
		attemptTasks = append(attemptTasks, task)
		attemptTasks = append(attemptTasks, removedTasks...)

		unplaced, err := g.PlaceWeeklyTasks(scheduleID, attemptTasks, ctx)
		if err != nil {
			return false, err
		}

		placedCount := len(attemptTasks) - len(unplaced)
		targetPlaced := !containsWeeklyTask(unplaced, task)

		if targetPlaced && placedCount > len(removedSlots) {
			score := g.scoreGeneratedSchedule(ctx, g.countScheduledSlots(ctx.ExistingSlots), len(unplaced))
			if bestWeekday == -1 || score > bestScore {
				bestScore = score
				bestWeekday = weekday
			}
		}

		// Undo this attempt and restore for the next weekday exploration.
		createdSlots := g.collectNewestAutoSlots(scheduleID, placedCount)
		if err := g.deleteSlotsForRepair(createdSlots); err != nil {
			return false, err
		}
		g.removeSlotsFromContext(createdSlots, ctx)
		if err := g.restoreSlotsAfterRepair(removedSlots, ctx); err != nil {
			return false, err
		}
	}

	if bestWeekday == -1 {
		return false, nil
	}

	// Apply the best weekday's solution.
	// After exploration, slots for bestWeekday are restored in ctx (possibly with new IDs).
	removedSlots := g.collectRepairSwapSlots(task, bestWeekday, ctx)
	removedTasks := g.weeklyTasksFromSlots(removedSlots, ctx)

	if err := g.deleteSlotsForRepair(removedSlots); err != nil {
		return false, err
	}
	g.removeSlotsFromContext(removedSlots, ctx)

	attemptTasks := make([]WeeklyTask, 0, len(removedTasks)+1)
	attemptTasks = append(attemptTasks, task)
	attemptTasks = append(attemptTasks, removedTasks...)

	if _, err := g.PlaceWeeklyTasks(scheduleID, attemptTasks, ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (g *ScheduleGenerator) collectRepairSwapSlots(task WeeklyTask, weekday int, ctx *GenerationContext) []models.ScheduleSlot {
	var slots []models.ScheduleSlot
	for _, slot := range ctx.ExistingSlots {
		if slot.Origin != models.ScheduleSlotOriginAuto || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if slot.SlotType != models.SlotTypeIndividual || slot.AssignmentID == nil {
			continue
		}
		if slot.TeacherID != task.TeacherID || slot.Weekday != weekday {
			continue
		}
		slots = append(slots, slot)
	}

	sort.Slice(slots, func(i, j int) bool {
		return slots[i].StartTime < slots[j].StartTime
	})

	if len(slots) > MaxRepairSwapSlots {
		return slots[:MaxRepairSwapSlots]
	}
	return slots
}

func (g *ScheduleGenerator) weeklyTasksFromSlots(slots []models.ScheduleSlot, ctx *GenerationContext) []WeeklyTask {
	tasks := make([]WeeklyTask, 0, len(slots))
	for _, slot := range slots {
		if slot.AssignmentID == nil {
			continue
		}
		task, ok := g.weeklyTaskFromAssignmentID(*slot.AssignmentID, ctx)
		if !ok {
			continue
		}
		tasks = append(tasks, task)
	}
	return tasks
}

func (g *ScheduleGenerator) weeklyTaskFromAssignmentID(assignmentID uint, ctx *GenerationContext) (WeeklyTask, bool) {
	for _, assignment := range ctx.Assignments {
		if assignment.ID != assignmentID {
			continue
		}
		_, durationMin, status := g.ResolveAssignmentParams(assignment)
		if status != models.AssignmentStatusActive {
			return WeeklyTask{}, false
		}
		hasStrictRoom := ctx.StrictTeacherIDs[assignment.TeacherID]
		windowMinutes := g.computeAvailableWindowMinutes(assignment.TeacherID, assignment.StudentID, ctx)
		return WeeklyTask{
			AssignmentID:           assignment.ID,
			StudentID:              assignment.StudentID,
			TeacherID:              assignment.TeacherID,
			SubjectID:              assignment.SubjectID,
			StudentName:            assignment.Student.FullName,
			TeacherName:            assignment.Teacher.FullName,
			SubjectName:            assignment.Subject.Name,
			FundingType:            assignment.FundingType,
			VisitsPerWeek:          1,
			DurationMin:            durationMin,
			TaskIndex:              1,
			HasStrictRoom:          hasStrictRoom,
			AvailableWindowMinutes: windowMinutes,
		}, true
	}
	return WeeklyTask{}, false
}

func (g *ScheduleGenerator) deleteSlotsForRepair(slots []models.ScheduleSlot) error {
	for _, slot := range slots {
		if err := g.db.Delete(&models.ScheduleSlot{}, slot.ID).Error; err != nil {
			return fmt.Errorf("failed to delete slot during repair: %w", err)
		}
	}
	return nil
}

func (g *ScheduleGenerator) removeSlotsFromContext(slots []models.ScheduleSlot, ctx *GenerationContext) {
	removed := make(map[uint]bool, len(slots))
	for _, slot := range slots {
		removed[slot.ID] = true
	}

	filtered := ctx.ExistingSlots[:0]
	for _, slot := range ctx.ExistingSlots {
		if !removed[slot.ID] {
			filtered = append(filtered, slot)
		}
	}
	ctx.ExistingSlots = filtered
}

func (g *ScheduleGenerator) restoreSlotsAfterRepair(slots []models.ScheduleSlot, ctx *GenerationContext) error {
	for _, oldSlot := range slots {
		restored := oldSlot
		restored.ID = 0
		if err := g.db.Create(&restored).Error; err != nil {
			return fmt.Errorf("failed to restore slot during repair: %w", err)
		}
		ctx.ExistingSlots = append(ctx.ExistingSlots, restored)
	}
	return nil
}

func (g *ScheduleGenerator) RestoreAutoSlots(slots []models.ScheduleSlot) error {
	for _, oldSlot := range slots {
		restored := oldSlot
		restored.ID = 0
		restored.CreatedAt = time.Time{}
		restored.UpdatedAt = time.Time{}
		if err := g.db.Create(&restored).Error; err != nil {
			return fmt.Errorf("failed to restore best generated slot: %w", err)
		}
	}
	return nil
}

func (g *ScheduleGenerator) copyAutoSlots(slots []models.ScheduleSlot) []models.ScheduleSlot {
	result := make([]models.ScheduleSlot, 0)
	for _, slot := range slots {
		if slot.Origin == models.ScheduleSlotOriginAuto && slot.Status != models.ScheduleSlotStatusCancelled {
			result = append(result, slot)
		}
	}
	return result
}

func (g *ScheduleGenerator) collectNewestAutoSlots(scheduleID uint, limit int) []models.ScheduleSlot {
	if limit <= 0 {
		return nil
	}

	var slots []models.ScheduleSlot
	if err := g.db.
		Where("schedule_id = ? AND origin = ?", scheduleID, models.ScheduleSlotOriginAuto).
		Order("id DESC").
		Limit(limit).
		Find(&slots).Error; err != nil {
		return nil
	}
	return slots
}

func containsWeeklyTask(tasks []WeeklyTask, needle WeeklyTask) bool {
	for _, task := range tasks {
		if task.AssignmentID == needle.AssignmentID && task.TaskIndex == needle.TaskIndex {
			return true
		}
	}
	return false
}

func (g *ScheduleGenerator) ResolveAssignmentParams(assignment models.Assignment) (int, int, string) {
	return assignment.VisitsPerWeek, assignment.DurationMin, assignment.Status
}

func (g *ScheduleGenerator) BuildWeeklyTasks(
	assignments []models.Assignment,
	ctx *GenerationContext,
) []WeeklyTask {
	var tasks []WeeklyTask

	for _, assignment := range assignments {
		visitsPerWeek, durationMin, status := g.ResolveAssignmentParams(assignment)

		if status != models.AssignmentStatusActive {
			continue
		}

		visitsPerWeek -= g.countExistingAssignmentSlots(assignment.ID, ctx.ExistingSlots)
		if visitsPerWeek <= 0 {
			continue
		}

		hasStrictRoom := ctx.StrictTeacherIDs[assignment.TeacherID]
		windowMinutes := g.computeAvailableWindowMinutes(assignment.TeacherID, assignment.StudentID, ctx)
		expanded := g.ExpandTasks(assignment, visitsPerWeek, durationMin, hasStrictRoom)
		for k := range expanded {
			expanded[k].AvailableWindowMinutes = windowMinutes
		}
		tasks = append(tasks, expanded...)
	}

	return tasks
}

func (g *ScheduleGenerator) ExpandTasks(
	assignment models.Assignment,
	visitsPerWeek int,
	durationMin int,
	hasStrictRoom bool,
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
			FundingType:   assignment.FundingType,
			VisitsPerWeek: visitsPerWeek,
			DurationMin:   durationMin,
			TaskIndex:     i + 1,
			HasStrictRoom: hasStrictRoom,
		})
	}

	return tasks
}

func (g *ScheduleGenerator) SortTasksByStrategy(tasks []WeeklyTask, strategy string) {
	sort.SliceStable(tasks, func(i, j int) bool {
		if tasks[i].FundingType != tasks[j].FundingType {
			return tasks[i].FundingType == models.FundingTypePaid
		}
		if tasks[i].HasStrictRoom != tasks[j].HasStrictRoom {
			return tasks[i].HasStrictRoom
		}

		switch strategy {
		case "no_availability":
			if tasks[i].VisitsPerWeek != tasks[j].VisitsPerWeek {
				return tasks[i].VisitsPerWeek > tasks[j].VisitsPerWeek
			}
			if tasks[i].DurationMin != tasks[j].DurationMin {
				return tasks[i].DurationMin > tasks[j].DurationMin
			}
		case "visits_first":
			if tasks[i].VisitsPerWeek != tasks[j].VisitsPerWeek {
				return tasks[i].VisitsPerWeek > tasks[j].VisitsPerWeek
			}
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
			}
		case "duration_first":
			if tasks[i].DurationMin != tasks[j].DurationMin {
				return tasks[i].DurationMin > tasks[j].DurationMin
			}
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
			}
		case "teacher_blocks":
			if tasks[i].TeacherName != tasks[j].TeacherName {
				return tasks[i].TeacherName < tasks[j].TeacherName
			}
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
			}
		case "student_blocks":
			if tasks[i].StudentName != tasks[j].StudentName {
				return tasks[i].StudentName < tasks[j].StudentName
			}
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
			}
		case "broad_availability":
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes > tasks[j].AvailableWindowMinutes
			}
			if tasks[i].VisitsPerWeek != tasks[j].VisitsPerWeek {
				return tasks[i].VisitsPerWeek > tasks[j].VisitsPerWeek
			}
		default:
			if tasks[i].AvailableWindowMinutes != tasks[j].AvailableWindowMinutes {
				return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
			}
			if tasks[i].VisitsPerWeek != tasks[j].VisitsPerWeek {
				return tasks[i].VisitsPerWeek > tasks[j].VisitsPerWeek
			}
			if tasks[i].DurationMin != tasks[j].DurationMin {
				return tasks[i].DurationMin > tasks[j].DurationMin
			}
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

	// Определяем допустимые кабинеты с учётом привязки преподавателя
	allowedRoomIDs := g.resolveAllowedRoomsForTeacher(task.TeacherID, task.SubjectID, ctx)

	if len(allowedRoomIDs) == 0 {
		return candidates
	}

	for weekday := 1; weekday <= 7; weekday++ {
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
					if g.validator.ViolatesSameSubjectConsecutiveRule(task.StudentID, task.SubjectID, weekday, startHHMM, endHHMM, ctx.ExistingSlots, ctx.GroupLessonEnrollments) {
						continue
					}
					if g.createsLargeStudentGap(task.StudentID, weekday, startHHMM, endHHMM, ctx.ExistingSlots, ctx.GroupLessonEnrollments) {
						continue
					}
					if !g.hasValidTeacherGap(task.TeacherID, weekday, startHHMM, endHHMM, ctx.ExistingSlots) {
						continue
					}

					for _, roomID := range allowedRoomIDs {
						if !g.validator.IsRoomAllowedForSubject(roomID, task.SubjectID, ctx.RoomSubjects) {
							continue
						}
						if g.validator.HasTeacherConflict(task.TeacherID, weekday, bufferedStart, bufferedEnd, ctx.ExistingSlots) {
							continue
						}
						if g.validator.HasStudentConflict(task.StudentID, weekday, bufferedStart, bufferedEnd, ctx.ExistingSlots, ctx.GroupLessonEnrollments) {
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

	// Уплотнение: бонус за примыкание к существующим слотам ученика
	for _, slot := range ctx.ExistingSlots {
		studentMatch := false
		if slot.SlotType == models.SlotTypeGroup {
			if slot.GroupLessonID != nil && isStudentEnrolledInGroup(task.StudentID, *slot.GroupLessonID, ctx.GroupLessonEnrollments) {
				// Don't score proximity to group slots that ignore student windows —
				// individual lessons are independent of them.
				if slot.GroupLesson != nil && slot.GroupLesson.IgnoreStudentWindows {
					continue
				}
				studentMatch = true
			}
		} else {
			if slot.StudentID != nil && *slot.StudentID == task.StudentID {
				studentMatch = true
			}
		}

		if studentMatch && slot.Weekday == candidate.Weekday {
			gap := gapMinutes(slot.EndTime, candidate.StartTime)
			reverseGap := gapMinutes(candidate.EndTime, slot.StartTime)

			if gap == IdealStudentGapMinutes || reverseGap == IdealStudentGapMinutes {
				score += 140
			} else if (gap >= 0 && gap <= g.maxStudentGapMinutes) || (reverseGap >= 0 && reverseGap <= g.maxStudentGapMinutes) {
				score += 70
			} else {
				score -= 100
			}
		}
	}

	// Уплотнение: бонус за примыкание к занятиям преподавателя
	for _, slot := range ctx.ExistingSlots {
		if slot.TeacherID == candidate.TeacherID && slot.Weekday == candidate.Weekday {
			gap := gapMinutes(slot.EndTime, candidate.StartTime)
			reverseGap := gapMinutes(candidate.EndTime, slot.StartTime)

			tMax := g.teacherGapMinutes
			if tMax < DefaultBreakMinutes {
				tMax = DefaultBreakMinutes
			}
			if (gap >= DefaultBreakMinutes && gap <= tMax) || (reverseGap >= DefaultBreakMinutes && reverseGap <= tMax) {
				score += 120
			} else {
				score -= 80
			}
			break
		}
	}

	// Небольшой бонус за более ранние слоты
	startMin := hhmmToMinutes(candidate.StartTime)
	if startMin >= 0 {
		score += (24*60 - startMin) / 30
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

// ========== ГРУППОВЫЕ ЗАНЯТИЯ ==========

func (g *ScheduleGenerator) countExistingAssignmentSlots(assignmentID uint, slots []models.ScheduleSlot) int {
	count := 0
	for _, slot := range slots {
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if slot.AssignmentID != nil && *slot.AssignmentID == assignmentID {
			count++
		}
	}
	return count
}

func (g *ScheduleGenerator) countScheduledSlots(slots []models.ScheduleSlot) int {
	count := 0
	for _, slot := range slots {
		if slot.Status != models.ScheduleSlotStatusCancelled {
			count++
		}
	}
	return count
}

func (g *ScheduleGenerator) scoreGeneratedSchedule(ctx *GenerationContext, scheduledCount int, unplacedCount int) int {
	score := scheduledCount * 100000
	score -= unplacedCount * 10000
	score -= g.totalStudentGapPenalty(ctx) * 20
	score -= g.totalTeacherGapPenalty(ctx) * 10
	return score
}

func (g *ScheduleGenerator) totalStudentGapPenalty(ctx *GenerationContext) int {
	total := 0
	studentIDs := make(map[uint]bool)
	for _, slot := range ctx.ExistingSlots {
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if slot.SlotType == models.SlotTypeGroup {
			if slot.GroupLessonID == nil {
				continue
			}
			for _, enrollment := range ctx.GroupLessonEnrollments {
				if enrollment.GroupLessonID == *slot.GroupLessonID {
					studentIDs[enrollment.StudentID] = true
				}
			}
		} else if slot.StudentID != nil {
			studentIDs[*slot.StudentID] = true
		}
	}

	for studentID := range studentIDs {
		for weekday := 1; weekday <= 7; weekday++ {
			total += g.studentGapPenalty(studentID, weekday, ctx)
		}
	}
	return total
}

func (g *ScheduleGenerator) studentGapPenalty(studentID uint, weekday int, ctx *GenerationContext) int {
	intervals := g.studentDayIntervals(studentID, weekday, ctx)
	total := 0
	for i := 1; i < len(intervals); i++ {
		gap := intervals[i][0] - intervals[i-1][1]
		if gap > IdealStudentGapMinutes {
			total += gap - IdealStudentGapMinutes
		}
	}
	return total
}

func (g *ScheduleGenerator) studentDayIntervals(studentID uint, weekday int, ctx *GenerationContext) [][2]int {
	var intervals [][2]int
	for _, slot := range ctx.ExistingSlots {
		if slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		studentMatch := false
		if slot.SlotType == models.SlotTypeGroup {
			if slot.GroupLessonID != nil && isStudentEnrolledInGroup(studentID, *slot.GroupLessonID, ctx.GroupLessonEnrollments) {
				studentMatch = true
			}
		} else if slot.StudentID != nil && *slot.StudentID == studentID {
			studentMatch = true
		}
		if !studentMatch {
			continue
		}

		start := hhmmToMinutes(slot.StartTime)
		end := hhmmToMinutes(slot.EndTime)
		if start >= 0 && end >= 0 {
			intervals = append(intervals, [2]int{start, end})
		}
	}

	sort.Slice(intervals, func(i, j int) bool {
		return intervals[i][0] < intervals[j][0]
	})
	return intervals
}

func (g *ScheduleGenerator) totalTeacherGapPenalty(ctx *GenerationContext) int {
	total := 0
	teacherIDs := make(map[uint]bool)
	for _, slot := range ctx.ExistingSlots {
		if slot.Status != models.ScheduleSlotStatusCancelled {
			teacherIDs[slot.TeacherID] = true
		}
	}

	for teacherID := range teacherIDs {
		for weekday := 1; weekday <= 7; weekday++ {
			total += g.teacherGapPenalty(teacherID, weekday, ctx)
		}
	}
	return total
}

func (g *ScheduleGenerator) teacherGapPenalty(teacherID uint, weekday int, ctx *GenerationContext) int {
	var intervals [][2]int
	for _, slot := range ctx.ExistingSlots {
		if slot.TeacherID != teacherID || slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		start := hhmmToMinutes(slot.StartTime)
		end := hhmmToMinutes(slot.EndTime)
		if start >= 0 && end >= 0 {
			intervals = append(intervals, [2]int{start, end})
		}
	}

	sort.Slice(intervals, func(i, j int) bool {
		return intervals[i][0] < intervals[j][0]
	})

	tMax := g.teacherGapMinutes
	if tMax < DefaultBreakMinutes {
		tMax = DefaultBreakMinutes
	}
	total := 0
	for i := 1; i < len(intervals); i++ {
		gap := intervals[i][0] - intervals[i-1][1]
		if gap > tMax {
			total += gap - tMax
		}
	}
	return total
}

func (g *ScheduleGenerator) hasValidTeacherGap(
	teacherID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
) bool {
	maxGap := g.teacherGapMinutes
	if maxGap < DefaultBreakMinutes {
		maxGap = DefaultBreakMinutes
	}
	hasTeacherSlotToday := false
	for _, slot := range existingSlots {
		if slot.TeacherID != teacherID || slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		hasTeacherSlotToday = true
		gap := gapMinutes(slot.EndTime, startTime)
		reverseGap := gapMinutes(endTime, slot.StartTime)
		if (gap >= DefaultBreakMinutes && gap <= maxGap) || (reverseGap >= DefaultBreakMinutes && reverseGap <= maxGap) {
			return true
		}
	}
	return !hasTeacherSlotToday
}

func (g *ScheduleGenerator) createsLargeStudentGap(
	studentID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
	enrollments []models.GroupLessonEnrollment,
) bool {
	type interval struct {
		start int
		end   int
	}

	start := hhmmToMinutes(startTime)
	end := hhmmToMinutes(endTime)
	if start < 0 || end < 0 {
		return true
	}

	intervals := []interval{{start: start, end: end}}
	for _, slot := range existingSlots {
		if slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		studentMatch := false
		if slot.SlotType == models.SlotTypeGroup {
			if slot.GroupLessonID != nil && isStudentEnrolledInGroup(studentID, *slot.GroupLessonID, enrollments) {
				// Group slots placed outside student windows must not constrain
				// individual lesson gap — they are independent of student schedule.
				if slot.GroupLesson != nil && slot.GroupLesson.IgnoreStudentWindows {
					continue
				}
				studentMatch = true
			}
		} else if slot.StudentID != nil && *slot.StudentID == studentID {
			studentMatch = true
		}
		if !studentMatch {
			continue
		}

		slotStart := hhmmToMinutes(slot.StartTime)
		slotEnd := hhmmToMinutes(slot.EndTime)
		if slotStart < 0 || slotEnd < 0 {
			continue
		}
		intervals = append(intervals, interval{start: slotStart, end: slotEnd})
	}

	sort.Slice(intervals, func(i, j int) bool {
		if intervals[i].start != intervals[j].start {
			return intervals[i].start < intervals[j].start
		}
		return intervals[i].end < intervals[j].end
	})

	for i := 1; i < len(intervals); i++ {
		gap := intervals[i].start - intervals[i-1].end
		if gap > g.maxStudentGapMinutes {
			return true
		}
	}
	return false
}

func (g *ScheduleGenerator) resolveAllowedRoomsForTeacher(teacherID uint, subjectID uint, ctx *GenerationContext) []uint {
	allSubjectRooms := g.getAllowedRoomIDs(subjectID, ctx.RoomSubjects)

	if strictRooms, ok := ctx.StrictTeacherRoomMap[teacherID]; ok && len(strictRooms) > 0 {
		// Строгий режим: только кабинеты из списка, которые поддерживают предмет
		var result []uint
		for _, roomID := range strictRooms {
			for _, allowed := range allSubjectRooms {
				if roomID == allowed {
					result = append(result, roomID)
					break
				}
			}
		}
		return result // Если пусто — кабинет не подходит для предмета
	}

	// Предпочтительные кабинеты идут первыми (если есть)
	if preferred, ok := ctx.PreferredTeacherRoomMap[teacherID]; ok && len(preferred) > 0 {
		preferredSet := make(map[uint]bool)
		for _, r := range preferred {
			preferredSet[r] = true
		}
		var result []uint
		for _, r := range preferred {
			for _, allowed := range allSubjectRooms {
				if r == allowed {
					result = append(result, r)
					break
				}
			}
		}
		for _, r := range allSubjectRooms {
			if !preferredSet[r] {
				result = append(result, r)
			}
		}
		return result
	}

	return allSubjectRooms
}

// ========== СОХРАНЕНИЕ ==========

// BackupAutoSlots сохраняет текущие авто-слоты расписания в таблицу бэкапов.
// Предыдущий бэкап для этого расписания удаляется перед сохранением нового.
func (g *ScheduleGenerator) BackupAutoSlots(scheduleID uint) error {
	var autoSlots []models.ScheduleSlot
	if err := g.db.
		Where("schedule_id = ? AND origin = ?", scheduleID, models.ScheduleSlotOriginAuto).
		Find(&autoSlots).Error; err != nil {
		return fmt.Errorf("failed to load auto slots for backup: %w", err)
	}
	if len(autoSlots) == 0 {
		return nil
	}

	if err := g.db.Where("schedule_id = ?", scheduleID).Delete(&models.ScheduleSlotBackup{}).Error; err != nil {
		return fmt.Errorf("failed to clear old backup: %w", err)
	}

	now := time.Now()
	backups := make([]models.ScheduleSlotBackup, 0, len(autoSlots))
	for _, s := range autoSlots {
		backups = append(backups, models.ScheduleSlotBackup{
			ScheduleID:    s.ScheduleID,
			SlotType:      s.SlotType,
			AssignmentID:  s.AssignmentID,
			GroupLessonID: s.GroupLessonID,
			StudentID:     s.StudentID,
			TeacherID:     s.TeacherID,
			SubjectID:     s.SubjectID,
			RoomID:        s.RoomID,
			RoomName:      s.RoomName,
			Weekday:       s.Weekday,
			StartTime:     s.StartTime,
			EndTime:       s.EndTime,
			Origin:        s.Origin,
			Status:        s.Status,
			BackedUpAt:    now,
		})
	}

	if err := g.db.Create(&backups).Error; err != nil {
		return fmt.Errorf("failed to save slot backup: %w", err)
	}
	return nil
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
	assignmentID := candidate.AssignmentID
	studentID := candidate.StudentID
	subjectID := candidate.SubjectID
	roomID := candidate.RoomID

	slot := &models.ScheduleSlot{
		ScheduleID:   scheduleID,
		SlotType:     models.SlotTypeIndividual,
		AssignmentID: &assignmentID,
		StudentID:    &studentID,
		TeacherID:    candidate.TeacherID,
		SubjectID:    &subjectID,
		RoomID:       &roomID,
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
	assignmentID := task.AssignmentID
	studentID := task.StudentID
	teacherID := task.TeacherID
	subjectID := task.SubjectID

	issue := models.ScheduleGenerationIssue{
		ScheduleID:   scheduleID,
		AssignmentID: &assignmentID,
		StudentID:    &studentID,
		TeacherID:    &teacherID,
		SubjectID:    &subjectID,
		ReasonCode:   reasonCode,
		Message:      message,
	}

	if err := g.db.Create(&issue).Error; err != nil {
		return fmt.Errorf("failed to save generation issue: %w", err)
	}

	return nil
}

func (g *ScheduleGenerator) CountRequestedVisits(assignments []models.Assignment) int {
	total := 0
	for _, assignment := range assignments {
		visits, _, status := g.ResolveAssignmentParams(assignment)
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
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
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
		Preload("GroupLesson").
		Where("schedule_id = ?", schedule.ID).
		Order("id ASC").
		Find(&issues).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch schedule generation issues: %w", err)
	}

	var assignments []models.Assignment
	if err := g.db.
		Joins("JOIN students ON students.id = assignments.student_id AND students.is_active = true").
		Joins("JOIN teachers ON teachers.id = assignments.teacher_id AND teachers.is_active = true").
		Where("assignments.status = ?", models.AssignmentStatusActive).
		Find(&assignments).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch assignments for stats: %w", err)
	}

	totalRequested := g.CountRequestedVisits(assignments)

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

func formatWeekdays(days []int) string {
	names := map[int]string{1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс"}
	parts := make([]string, 0, len(days))
	for _, d := range days {
		parts = append(parts, names[d])
	}
	return strings.Join(parts, ", ")
}

func (g *ScheduleGenerator) teacherAvailableDays(teacherID uint, ctx *GenerationContext) []int {
	var days []int
	for wd := 1; wd <= 7; wd++ {
		if len(g.filterTeacherAvailability(teacherID, wd, ctx.TeacherAvailability)) > 0 {
			days = append(days, wd)
		}
	}
	return days
}

func (g *ScheduleGenerator) studentAvailableDays(studentID uint, ctx *GenerationContext) []int {
	var days []int
	for wd := 1; wd <= 7; wd++ {
		if len(g.filterStudentAvailability(studentID, wd, ctx.StudentAvailability)) > 0 {
			days = append(days, wd)
		}
	}
	return days
}

func (g *ScheduleGenerator) DiagnoseNoCandidates(task WeeklyTask, ctx *GenerationContext) string {
	allSubjectRooms := g.getAllowedRoomIDs(task.SubjectID, ctx.RoomSubjects)
	if len(allSubjectRooms) == 0 {
		return fmt.Sprintf("Нет кабинетов для предмета «%s» — добавьте кабинет с поддержкой этого предмета", task.SubjectName)
	}
	if _, ok := ctx.StrictTeacherRoomMap[task.TeacherID]; ok {
		if len(g.resolveAllowedRoomsForTeacher(task.TeacherID, task.SubjectID, ctx)) == 0 {
			return fmt.Sprintf("Кабинеты строгой привязки преподавателя «%s» не настроены для предмета «%s»", task.TeacherName, task.SubjectName)
		}
	}

	teacherDays := g.teacherAvailableDays(task.TeacherID, ctx)
	if len(teacherDays) == 0 {
		return fmt.Sprintf("У преподавателя «%s» не задано рабочее время ни на один день недели", task.TeacherName)
	}

	studentDays := g.studentAvailableDays(task.StudentID, ctx)
	if len(studentDays) == 0 {
		return fmt.Sprintf("У ученика «%s» не указана доступность ни на один день недели", task.StudentName)
	}

	intersectionExists := false
	durationFits := false
	for wd := 1; wd <= 7; wd++ {
		teacherWindows := g.filterTeacherAvailability(task.TeacherID, wd, ctx.TeacherAvailability)
		studentWindows := g.filterStudentAvailability(task.StudentID, wd, ctx.StudentAvailability)
		for _, tw := range teacherWindows {
			for _, sw := range studentWindows {
				start, end, ok := intersectWindows(tw.StartTime, tw.EndTime, sw.StartTime, sw.EndTime)
				if !ok {
					continue
				}
				intersectionExists = true
				if hhmmToMinutes(end)-hhmmToMinutes(start) >= task.DurationMin {
					durationFits = true
				}
			}
		}
	}

	if !intersectionExists {
		return fmt.Sprintf("Нет пересечений по времени: преподаватель «%s» работает в [%s], ученик «%s» доступен в [%s]",
			task.TeacherName, formatWeekdays(teacherDays), task.StudentName, formatWeekdays(studentDays))
	}
	if !durationFits {
		return fmt.Sprintf("Общее доступное окно короче длительности занятия %d мин (преподаватель «%s», ученик «%s»)",
			task.DurationMin, task.TeacherName, task.StudentName)
	}

	return "Все возможные временные слоты заняты конфликтующими занятиями (преподаватель, ученик или кабинет недоступны)"
}

// timeHHMMToMinutes converts "HH:MM" string to total minutes since midnight.
func timeHHMMToMinutes(t string) int {
	if len(t) < 5 {
		return 0
	}
	h := int(t[0]-'0')*10 + int(t[1]-'0')
	m := int(t[3]-'0')*10 + int(t[4]-'0')
	return h*60 + m
}

// computeAvailableWindowMinutes returns the total minutes that a student and teacher
// share across all weekdays — the broader this window, the more scheduling flexibility exists.
// Results are cached in ctx.WindowMinutesCache since availability data doesn't change during generation.
func (g *ScheduleGenerator) computeAvailableWindowMinutes(teacherID, studentID uint, ctx *GenerationContext) int {
	key := teacherStudentKey{teacherID, studentID}
	if v, ok := ctx.WindowMinutesCache[key]; ok {
		return v
	}
	total := 0
	for weekday := 1; weekday <= 7; weekday++ {
		teacherWindows := g.filterTeacherAvailability(teacherID, weekday, ctx.TeacherAvailability)
		studentWindows := g.filterStudentAvailability(studentID, weekday, ctx.StudentAvailability)
		for _, tw := range teacherWindows {
			for _, sw := range studentWindows {
				start, end, ok := intersectWindows(tw.StartTime, tw.EndTime, sw.StartTime, sw.EndTime)
				if ok {
					total += timeHHMMToMinutes(end) - timeHHMMToMinutes(start)
				}
			}
		}
	}
	ctx.WindowMinutesCache[key] = total
	return total
}
