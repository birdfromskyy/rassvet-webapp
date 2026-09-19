package services

import (
	"backend/internal/models"
	"log"
	"sort"
)

// Packed-days pipeline: вместо жадной расстановки задач по одной, каждый день
// преподавателя упаковывается целиком как непрерывная цепочка занятий.
//
// Причина: жёсткое правило "перерыв преподавателя ≤ N минут" превращает день
// в одну связную цепочку. Жадный алгоритм наращивает её от случайного якоря,
// и ученики с узкими окнами (например, только 09:00-11:00) навсегда отрезаются,
// если цепочка не успела дойти до их окна. Здесь цепочка строится осознанно:
// перебираются стартовые точки, и в каждой позиции таймлайна выбирается ученик
// с наименьшим числом запасных дней и самым ранним концом окна (EDF).
//
// Все жёсткие ограничения проверяются теми же валидаторами, что и в жадном
// проходе. Ручные и групповые занятия — обязательные якоря: план дня, чья
// цепочка не дотягивается до якоря, отбрасывается.

// packPlacement — одно занятие в плане дня.
type packPlacement struct {
	taskIdx  int // индекс в срезе задач дня
	roomID   uint
	startMin int
	endMin   int
}

// packDayPlan — результат симуляции одного варианта дня.
type packDayPlan struct {
	placements   []packPlacement
	totalMinutes int
	chainStart   int
}

func (p *packDayPlan) betterThan(other *packDayPlan) bool {
	if other == nil {
		return true
	}
	if len(p.placements) != len(other.placements) {
		return len(p.placements) > len(other.placements)
	}
	if p.totalMinutes != other.totalMinutes {
		return p.totalMinutes > other.totalMinutes
	}
	return p.chainStart < other.chainStart
}

// runPackedDaysPipeline упаковывает дни преподавателей, чья загрузка
// (минуты занятий / минуты доступности) не ниже minLoadRatio; задачи остальных
// преподавателей и все неупакованные остатки идут через жадный конвейер.
func (g *ScheduleGenerator) runPackedDaysPipeline(
	scheduleID uint,
	tasks []WeeklyTask,
	minLoadRatio float64,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	usableDays := g.computeUsableDays(tasks, ctx)

	// Группируем задачи по преподавателям; перегруженные идут первыми,
	// чтобы их цепочки строились до того, как чужие ученики займут общее время.
	byTeacher := make(map[uint][]WeeklyTask)
	for _, t := range tasks {
		byTeacher[t.TeacherID] = append(byTeacher[t.TeacherID], t)
	}
	teacherIDs := make([]uint, 0, len(byTeacher))
	for id := range byTeacher {
		teacherIDs = append(teacherIDs, id)
	}
	sort.Slice(teacherIDs, func(i, j int) bool {
		a, b := byTeacher[teacherIDs[i]], byTeacher[teacherIDs[j]]
		if len(a) != len(b) {
			return len(a) > len(b)
		}
		return a[0].TeacherName < b[0].TeacherName
	})

	leftovers := make([]WeeklyTask, 0)
	for _, teacherID := range teacherIDs {
		remaining := byTeacher[teacherID]
		if g.teacherLoadRatio(teacherID, remaining, ctx) < minLoadRatio {
			leftovers = append(leftovers, remaining...)
			continue
		}
		total := len(remaining)
		for weekday := 1; weekday <= 7 && len(remaining) > 0; weekday++ {
			var err error
			remaining, err = g.packTeacherDay(scheduleID, teacherID, weekday, remaining, usableDays, ctx)
			if err != nil {
				return nil, err
			}
		}
		log.Printf("[GEN] packed-days: %s packed %d/%d", byTeacher[teacherID][0].TeacherName, total-len(remaining), total)
		leftovers = append(leftovers, remaining...)
	}

	log.Printf("[GEN] packed-days: %d tasks packed, %d leftover → greedy fallback", len(tasks)-len(leftovers), len(leftovers))

	// Остатки — через обычный жадный конвейер с ремонтом и retry-проходами:
	// он может доставить занятия, примыкая к уже построенным цепочкам.
	// Порядок teacher_blocks (по преподавателям) стабильно лучший для остатка.
	g.SortTasksByStrategy(leftovers, "teacher_blocks")
	return g.runIndividualTaskPipeline(scheduleID, leftovers, ctx)
}

// teacherLoadRatio — отношение требуемых минут занятий к минутам доступности.
func (g *ScheduleGenerator) teacherLoadRatio(teacherID uint, tasks []WeeklyTask, ctx *GenerationContext) float64 {
	demand := 0
	for _, t := range tasks {
		demand += t.DurationMin
	}
	capacity := 0
	for _, a := range ctx.TeacherAvailability {
		if a.TeacherID != teacherID {
			continue
		}
		start, end := hhmmToMinutes(a.StartTime), hhmmToMinutes(a.EndTime)
		if start >= 0 && end > start {
			capacity += end - start
		}
	}
	if capacity == 0 {
		return 0
	}
	return float64(demand) / float64(capacity)
}

// computeUsableDays возвращает, на скольких днях недели окно teacher∩student
// вмещает занятие. Чем меньше дней — тем раньше задача должна быть поставлена.
func (g *ScheduleGenerator) computeUsableDays(tasks []WeeklyTask, ctx *GenerationContext) map[uint]int {
	result := make(map[uint]int, len(tasks))
	for _, task := range tasks {
		if _, ok := result[task.AssignmentID]; ok {
			continue
		}
		days := 0
		for weekday := 1; weekday <= 7; weekday++ {
			if g.dayWindowDeadline(task, weekday, ctx) >= 0 {
				days++
			}
		}
		result[task.AssignmentID] = days
	}
	return result
}

// dayWindowDeadline возвращает самый поздний конец окна teacher∩student в этот
// день, в котором помещается занятие; -1 если день непригоден.
func (g *ScheduleGenerator) dayWindowDeadline(task WeeklyTask, weekday int, ctx *GenerationContext) int {
	teacherWindows := g.filterTeacherAvailability(task.TeacherID, weekday, ctx.TeacherAvailability)
	studentWindows := g.filterStudentAvailability(task.StudentID, weekday, ctx.StudentAvailability)
	deadline := -1
	for _, tw := range teacherWindows {
		for _, sw := range studentWindows {
			start, end, ok := intersectWindows(tw.StartTime, tw.EndTime, sw.StartTime, sw.EndTime)
			if !ok {
				continue
			}
			startMin, endMin := hhmmToMinutes(start), hhmmToMinutes(end)
			if startMin < 0 || endMin < 0 || endMin-startMin < task.DurationMin {
				continue
			}
			if endMin > deadline {
				deadline = endMin
			}
		}
	}
	return deadline
}

func (g *ScheduleGenerator) packTeacherDay(
	scheduleID uint,
	teacherID uint,
	weekday int,
	remaining []WeeklyTask,
	usableDays map[uint]int,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	teacherWindows := g.filterTeacherAvailability(teacherID, weekday, ctx.TeacherAvailability)
	if len(teacherWindows) == 0 {
		return remaining, nil
	}

	// Задачи, которым этот день в принципе подходит, с их дедлайнами.
	type dayTask struct {
		idx      int
		deadline int
	}
	dayTasks := make([]dayTask, 0, len(remaining))
	for i, task := range remaining {
		if d := g.dayWindowDeadline(task, weekday, ctx); d >= 0 {
			dayTasks = append(dayTasks, dayTask{idx: i, deadline: d})
		}
	}
	if len(dayTasks) == 0 {
		return remaining, nil
	}
	deadlines := make(map[int]int, len(dayTasks))
	dayTaskIdx := make([]int, 0, len(dayTasks))
	for _, dt := range dayTasks {
		deadlines[dt.idx] = dt.deadline
		dayTaskIdx = append(dayTaskIdx, dt.idx)
	}

	// Якоря — существующие занятия преподавателя в этот день (ручные, групповые,
	// уже упакованные). Цепочка обязана включать их все.
	anchors := g.teacherDayAnchors(teacherID, weekday, ctx.ExistingSlots)
	starts := g.candidateChainStarts(teacherID, weekday, remaining, dayTaskIdx, anchors, ctx)
	if len(starts) == 0 {
		return remaining, nil
	}

	var best *packDayPlan
	for _, s := range starts {
		for _, policy := range []packPolicy{policyScarcity, policyContinuation} {
			plan := g.simulateDayChain(s, weekday, policy, remaining, dayTaskIdx, deadlines, usableDays, anchors, ctx)
			if plan != nil && len(plan.placements) > 0 && plan.betterThan(best) {
				best = plan
			}
		}
	}
	if best == nil {
		return remaining, nil
	}

	// Применяем лучший план: сохраняем слоты и убираем задачи из остатка.
	used := make(map[int]bool, len(best.placements))
	for _, p := range best.placements {
		task := remaining[p.taskIdx]
		candidate := CandidateSlot{
			AssignmentID: task.AssignmentID,
			StudentID:    task.StudentID,
			TeacherID:    task.TeacherID,
			SubjectID:    task.SubjectID,
			RoomID:       p.roomID,
			Weekday:      weekday,
			StartTime:    minutesToHHMM(p.startMin),
			EndTime:      minutesToHHMM(p.endMin),
		}
		slot, err := g.SaveGeneratedSlot(scheduleID, candidate)
		if err != nil {
			return nil, err
		}
		ctx.ExistingSlots = append(ctx.ExistingSlots, generatedSlotForContext(slot, task))
		used[p.taskIdx] = true
	}

	next := make([]WeeklyTask, 0, len(remaining)-len(used))
	for i, task := range remaining {
		if !used[i] {
			next = append(next, task)
		}
	}
	return next, nil
}

// teacherDayAnchors возвращает интервалы существующих занятий преподавателя
// в этот день, отсортированные по началу.
func (g *ScheduleGenerator) teacherDayAnchors(teacherID uint, weekday int, slots []models.ScheduleSlot) [][2]int {
	var anchors [][2]int
	for _, slot := range slots {
		if !slotHasTeacher(slot, teacherID) || slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		start, end := hhmmToMinutes(slot.StartTime), hhmmToMinutes(slot.EndTime)
		if start >= 0 && end >= 0 {
			anchors = append(anchors, [2]int{start, end})
		}
	}
	sort.Slice(anchors, func(i, j int) bool { return anchors[i][0] < anchors[j][0] })
	return anchors
}

// candidateChainStarts собирает стартовые точки цепочки: начала пересечений
// окон и начала рабочих окон. При наличии якорей — только точки не позже
// первого якоря (цепочка растёт слева направо и должна его включить).
func (g *ScheduleGenerator) candidateChainStarts(
	teacherID uint,
	weekday int,
	remaining []WeeklyTask,
	dayTaskIdx []int,
	anchors [][2]int,
	ctx *GenerationContext,
) []int {
	teacherWindows := g.filterTeacherAvailability(teacherID, weekday, ctx.TeacherAvailability)
	startSet := make(map[int]bool)

	for _, tw := range teacherWindows {
		if v := hhmmToMinutes(tw.StartTime); v >= 0 {
			startSet[v] = true
		}
	}
	for _, idx := range dayTaskIdx {
		task := remaining[idx]
		studentWindows := g.filterStudentAvailability(task.StudentID, weekday, ctx.StudentAvailability)
		for _, tw := range teacherWindows {
			for _, sw := range studentWindows {
				start, _, ok := intersectWindows(tw.StartTime, tw.EndTime, sw.StartTime, sw.EndTime)
				if !ok {
					continue
				}
				if v := hhmmToMinutes(start); v >= 0 {
					startSet[v] = true
				}
			}
		}
	}
	if len(anchors) > 0 {
		startSet[anchors[0][0]] = true
	}

	starts := make([]int, 0, len(startSet))
	for v := range startSet {
		if len(anchors) > 0 && v > anchors[0][0] {
			continue
		}
		starts = append(starts, v)
	}
	sort.Ints(starts)
	return starts
}

// packPolicy — политика выбора задачи в позиции цепочки.
type packPolicy int

const (
	// policyScarcity: меньше пригодных дней → раньше дедлайн.
	policyScarcity packPolicy = iota
	// policyContinuation: сначала продолжаем занятия того же ученика, что и
	// в предыдущем слоте — ученики с несколькими визитами в день обязаны
	// стоять сплошным блоком (жёсткий лимит перерыва ученика), иначе их
	// оставшиеся визиты становятся невозможными.
	policyContinuation
)

// simulateDayChain строит цепочку от старта s in-memory. Возвращает nil, если
// цепочка обрывается, не дойдя до обязательного якоря.
func (g *ScheduleGenerator) simulateDayChain(
	s int,
	weekday int,
	policy packPolicy,
	remaining []WeeklyTask,
	dayTaskIdx []int,
	deadlines map[int]int,
	usableDays map[uint]int,
	anchors [][2]int,
	ctx *GenerationContext,
) *packDayPlan {
	maxGap := g.teacherGapMinutes
	if maxGap < MinimumConfiguredGapMinutes {
		maxGap = MinimumConfiguredGapMinutes
	}

	sim := make([]models.ScheduleSlot, len(ctx.ExistingSlots), len(ctx.ExistingSlots)+len(dayTaskIdx))
	copy(sim, ctx.ExistingSlots)

	plan := &packDayPlan{chainStart: s}
	usedIdx := make(map[int]bool, len(dayTaskIdx))
	pendingAnchors := make([][2]int, len(anchors))
	copy(pendingAnchors, anchors)

	frontier := s
	chainStarted := false
	var lastStudentID uint

	consumeAnchors := func() {
		for len(pendingAnchors) > 0 && pendingAnchors[0][0] <= frontier {
			if pendingAnchors[0][1] > frontier {
				frontier = pendingAnchors[0][1]
			}
			pendingAnchors = pendingAnchors[1:]
			chainStarted = true
		}
	}

	for {
		consumeAnchors()

		placed := false
		for d := 0; d <= maxGap && !placed; d += 5 {
			candidateStart := frontier + d
			bestIdx, bestRoom := -1, uint(0)
			bestIsContinuation := false
			for _, idx := range dayTaskIdx {
				if usedIdx[idx] {
					continue
				}
				roomID, ok := g.canPlaceTaskAt(remaining[idx], weekday, candidateStart, sim, ctx)
				if !ok {
					continue
				}
				isContinuation := policy == policyContinuation &&
					lastStudentID != 0 && remaining[idx].StudentID == lastStudentID
				switch {
				case bestIdx == -1:
				case isContinuation && !bestIsContinuation:
				case isContinuation == bestIsContinuation &&
					g.packTaskLess(remaining, idx, bestIdx, deadlines, usableDays):
				default:
					continue
				}
				bestIdx, bestRoom = idx, roomID
				bestIsContinuation = isContinuation
			}
			if bestIdx == -1 {
				continue
			}

			task := remaining[bestIdx]
			endMin := candidateStart + task.DurationMin
			assignmentID, studentID, subjectID, roomID := task.AssignmentID, task.StudentID, task.SubjectID, bestRoom
			sim = append(sim, models.ScheduleSlot{
				ScheduleID:   ctx.Schedule.ID,
				SlotType:     models.SlotTypeIndividual,
				AssignmentID: &assignmentID,
				StudentID:    &studentID,
				TeacherID:    task.TeacherID,
				SubjectID:    &subjectID,
				RoomID:       &roomID,
				Weekday:      weekday,
				StartTime:    minutesToHHMM(candidateStart),
				EndTime:      minutesToHHMM(endMin),
				Origin:       models.ScheduleSlotOriginAuto,
				Status:       models.ScheduleSlotStatusScheduled,
			})
			plan.placements = append(plan.placements, packPlacement{
				taskIdx:  bestIdx,
				roomID:   bestRoom,
				startMin: candidateStart,
				endMin:   endMin,
			})
			plan.totalMinutes += task.DurationMin
			usedIdx[bestIdx] = true
			frontier = endMin
			chainStarted = true
			lastStudentID = task.StudentID
			placed = true
		}
		if placed {
			continue
		}

		// Ничего не поместилось рядом с фронтиром. Если впереди якорь в пределах
		// допустимого перерыва — перепрыгиваем на него, иначе цепочка окончена.
		if len(pendingAnchors) > 0 {
			gapToAnchor := pendingAnchors[0][0] - frontier
			if !chainStarted || (gapToAnchor >= 0 && gapToAnchor <= maxGap) {
				frontier = pendingAnchors[0][1]
				pendingAnchors = pendingAnchors[1:]
				chainStarted = true
				continue
			}
			// Цепочка не дотянулась до обязательного якоря — план недопустим.
			return nil
		}
		break
	}

	return plan
}

// packTaskLess: true если задача a должна стоять раньше b в позиции цепочки.
// Критерии: меньше пригодных дней → раньше дедлайн окна → платные → уже общее окно.
func (g *ScheduleGenerator) packTaskLess(
	remaining []WeeklyTask,
	a, b int,
	deadlines map[int]int,
	usableDays map[uint]int,
) bool {
	ta, tb := remaining[a], remaining[b]
	da, db := usableDays[ta.AssignmentID], usableDays[tb.AssignmentID]
	if da != db {
		return da < db
	}
	if deadlines[a] != deadlines[b] {
		return deadlines[a] < deadlines[b]
	}
	if ta.AllowScheduleWindows != tb.AllowScheduleWindows {
		return !ta.AllowScheduleWindows
	}
	if ta.FundingType != tb.FundingType {
		return ta.FundingType == models.FundingTypePaid
	}
	if ta.AvailableWindowMinutes != tb.AvailableWindowMinutes {
		return ta.AvailableWindowMinutes < tb.AvailableWindowMinutes
	}
	if ta.AssignmentID != tb.AssignmentID {
		return ta.AssignmentID < tb.AssignmentID
	}
	return ta.TaskIndex < tb.TaskIndex
}

// canPlaceTaskAt проверяет все жёсткие ограничения для занятия в фиксированное
// время (те же проверки, что и в GetCandidateSlots, кроме hasValidTeacherGap —
// связность цепочки гарантирует сама структура прохода). Возвращает кабинет.
func (g *ScheduleGenerator) canPlaceTaskAt(
	task WeeklyTask,
	weekday int,
	startMin int,
	sim []models.ScheduleSlot,
	ctx *GenerationContext,
) (uint, bool) {
	endMin := startMin + task.DurationMin
	startHHMM := minutesToHHMM(startMin)
	endHHMM := minutesToHHMM(endMin)
	if !g.validator.IsTeacherAvailable(task.TeacherID, weekday, startHHMM, endHHMM, ctx.TeacherAvailability) {
		return 0, false
	}
	if !g.validator.IsStudentAvailable(task.StudentID, weekday, startHHMM, endHHMM, ctx.StudentAvailability) {
		return 0, false
	}
	if g.validator.ViolatesSameDayRule(task.AssignmentID, weekday, sim) {
		return 0, false
	}
	if g.validator.ViolatesSameSubjectConsecutiveRule(task.StudentID, task.SubjectID, weekday, startHHMM, endHHMM, sim, ctx.GroupLessonEnrollments) {
		return 0, false
	}
	if g.violatesMinimumBreak(task, weekday, startHHMM, endHHMM, sim, ctx) {
		return 0, false
	}
	if g.createsLargeStudentGap(task.StudentID, weekday, startHHMM, endHHMM, sim, ctx.GroupLessonEnrollments, ctx.StudentAllowsWindows[task.StudentID]) {
		return 0, false
	}
	if g.validator.HasTeacherConflict(task.TeacherID, weekday, startHHMM, endHHMM, sim) {
		return 0, false
	}
	if g.validator.HasStudentConflict(task.StudentID, weekday, startHHMM, endHHMM, sim, ctx.GroupLessonEnrollments) {
		return 0, false
	}

	for _, roomID := range g.resolveAllowedRoomsForTeacher(task.TeacherID, task.SubjectID, ctx) {
		if !g.validator.IsRoomAllowedForSubject(roomID, task.SubjectID, ctx.RoomSubjects) {
			continue
		}
		if g.validator.HasRoomConflict(roomID, weekday, startHHMM, endHHMM, sim) {
			continue
		}
		return roomID, true
	}
	return 0, false
}
