package services

import (
	"backend/internal/models"
	"log"
	"sort"
)

// Финальный полирующий проход: релокация одиночных блокеров.
//
// Для каждого непроставленного занятия T ищутся позиции, в которых все
// ограничения выполняются, кроме конфликта ровно с одним авто-слотом B.
// Тогда B переносится в другое валидное место, а T встаёт на освободившееся.
// Коммит только если оба занятия размещены и все цепочки (жёсткие лимиты
// перерывов преподавателей и учеников) остаются валидными — иначе откат.
// Запускается один раз на финальном результате, не внутри гонки стратегий.

type relocationCandidate struct {
	weekday  int
	startMin int
	roomID   uint
	blocker  models.ScheduleSlot
}

func (g *ScheduleGenerator) RepairWeeklyTasksWithRelocation(
	scheduleID uint,
	tasks []WeeklyTask,
	ctx *GenerationContext,
) ([]WeeklyTask, error) {
	if len(tasks) == 0 {
		return tasks, nil
	}

	// Перегруженные преподаватели первыми — у них меньше всего запасных позиций.
	sort.SliceStable(tasks, func(i, j int) bool {
		if tasks[i].TeacherTotalTasks != tasks[j].TeacherTotalTasks {
			return tasks[i].TeacherTotalTasks > tasks[j].TeacherTotalTasks
		}
		return tasks[i].AvailableWindowMinutes < tasks[j].AvailableWindowMinutes
	})

	remaining := make([]WeeklyTask, 0, len(tasks))
	placedCount := 0
	for _, task := range tasks {
		placed, err := g.tryRelocationForTask(scheduleID, task, ctx)
		if err != nil {
			return nil, err
		}
		if placed {
			placedCount++
		} else {
			remaining = append(remaining, task)
		}
	}
	if placedCount > 0 {
		log.Printf("[GEN] relocation repair: placed %d more via single-blocker moves", placedCount)
	}
	return remaining, nil
}

func (g *ScheduleGenerator) tryRelocationForTask(
	scheduleID uint,
	task WeeklyTask,
	ctx *GenerationContext,
) (bool, error) {
	for _, cand := range g.findSingleBlockerPositions(task, ctx) {
		ok, err := g.applyRelocation(scheduleID, task, cand, ctx)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}

// findSingleBlockerPositions перебирает все допустимые позиции занятия и
// возвращает те, где мешает ровно один перемещаемый авто-слот.
func (g *ScheduleGenerator) findSingleBlockerPositions(task WeeklyTask, ctx *GenerationContext) []relocationCandidate {
	var result []relocationCandidate
	allowedRoomIDs := g.resolveAllowedRoomsForTeacher(task.TeacherID, task.SubjectID, ctx)
	if len(allowedRoomIDs) == 0 {
		return result
	}

	for weekday := 1; weekday <= 7; weekday++ {
		if g.validator.ViolatesSameDayRule(task.AssignmentID, weekday, ctx.ExistingSlots) {
			continue
		}
		teacherWindows := g.filterTeacherAvailability(task.TeacherID, weekday, ctx.TeacherAvailability)
		studentWindows := g.filterStudentAvailability(task.StudentID, weekday, ctx.StudentAvailability)
		for _, tw := range teacherWindows {
			for _, sw := range studentWindows {
				start, end, ok := intersectWindows(tw.StartTime, tw.EndTime, sw.StartTime, sw.EndTime)
				if !ok {
					continue
				}
				startMin, endMin := hhmmToMinutes(start), hhmmToMinutes(end)
				if startMin < 0 || endMin < 0 {
					continue
				}
				for slotStart := startMin; slotStart+task.DurationMin <= endMin; slotStart += 5 {
					startHHMM := minutesToHHMM(slotStart)
					endHHMM := minutesToHHMM(slotStart + task.DurationMin)
					if g.validator.ViolatesSameSubjectConsecutiveRule(task.StudentID, task.SubjectID, weekday, startHHMM, endHHMM, ctx.ExistingSlots, ctx.GroupLessonEnrollments) {
						continue
					}
					for _, roomID := range allowedRoomIDs {
						blocker, ok := g.singleMovableBlocker(task, weekday, startHHMM, endHHMM, roomID, ctx)
						if !ok {
							continue
						}
						result = append(result, relocationCandidate{
							weekday:  weekday,
							startMin: slotStart,
							roomID:   roomID,
							blocker:  blocker,
						})
						break // одной комнаты на позицию достаточно
					}
				}
			}
		}
	}
	return result
}

// singleMovableBlocker возвращает единственный конфликтующий слот, если он
// авто-индивидуальный (перемещаемый); false — если блокеров нет, больше одного
// или блокер неподвижен (ручной/групповой).
func (g *ScheduleGenerator) singleMovableBlocker(
	task WeeklyTask,
	weekday int,
	startHHMM, endHHMM string,
	roomID uint,
	ctx *GenerationContext,
) (models.ScheduleSlot, bool) {
	blockerIDs := make(map[uint]bool)
	var blocker models.ScheduleSlot

	for _, slot := range ctx.ExistingSlots {
		if slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if !timesOverlap(startHHMM, endHHMM, slot.StartTime, slot.EndTime) {
			continue
		}

		conflict := slotHasTeacher(slot, task.TeacherID) ||
			(slot.RoomID != nil && *slot.RoomID == roomID)
		if !conflict {
			if slot.SlotType == models.SlotTypeGroup {
				conflict = slotHasStudent(slot, task.StudentID, ctx.GroupLessonEnrollments)
			} else {
				conflict = slot.StudentID != nil && *slot.StudentID == task.StudentID
			}
		}
		if !conflict {
			continue
		}
		if slot.Origin != models.ScheduleSlotOriginAuto || slot.SlotType != models.SlotTypeIndividual {
			return models.ScheduleSlot{}, false // неподвижный блокер
		}
		if !blockerIDs[slot.ID] {
			blockerIDs[slot.ID] = true
			blocker = slot
		}
	}

	if len(blockerIDs) != 1 {
		return models.ScheduleSlot{}, false
	}
	return blocker, true
}

// applyRelocation симулирует перенос: убирает блокер, ставит задачу, ищет
// блокеру новое место. Коммитит в БД только полностью успешную комбинацию.
func (g *ScheduleGenerator) applyRelocation(
	scheduleID uint,
	task WeeklyTask,
	cand relocationCandidate,
	ctx *GenerationContext,
) (bool, error) {
	blockerTask, ok := g.weeklyTaskFromAssignmentID(derefUint(cand.blocker.AssignmentID), ctx)
	if !ok {
		return false, nil
	}

	// sim = текущее расписание без блокера.
	sim := make([]models.ScheduleSlot, 0, len(ctx.ExistingSlots)+1)
	for _, s := range ctx.ExistingSlots {
		if s.ID != cand.blocker.ID {
			sim = append(sim, s)
		}
	}

	// Удаление блокера не должно рвать цепочки его преподавателя и ученика.
	if !g.dayChainsValid(cand.blocker.TeacherID, cand.blocker.StudentID, cand.blocker.Weekday, sim, ctx) {
		return false, nil
	}

	// Задача должна вставать со всеми проверками, включая примыкание к цепочке.
	startHHMM := minutesToHHMM(cand.startMin)
	if _, ok := g.canPlaceTaskAt(task, cand.weekday, cand.startMin, sim, ctx); !ok {
		return false, nil
	}
	if !g.hasValidTeacherGap(task.TeacherID, cand.weekday, startHHMM, minutesToHHMM(cand.startMin+task.DurationMin), sim) {
		return false, nil
	}
	taskSlot := buildSimSlot(scheduleID, task, cand.weekday, cand.startMin, cand.roomID)
	sim = append(sim, taskSlot)
	if !g.dayChainsValid(task.TeacherID, &task.StudentID, cand.weekday, sim, ctx) {
		return false, nil
	}

	// Ищем блокеру новое место на симулированном расписании.
	savedSlots := ctx.ExistingSlots
	ctx.ExistingSlots = sim
	blockerCandidates := g.GetCandidateSlots(blockerTask, ctx)
	ctx.ExistingSlots = savedSlots
	if len(blockerCandidates) == 0 {
		return false, nil
	}
	bestForBlocker := g.SelectBestCandidate(blockerCandidates)
	blockerSlot := buildSimSlot(scheduleID, blockerTask, bestForBlocker.Weekday, hhmmToMinutes(bestForBlocker.StartTime), bestForBlocker.RoomID)
	sim = append(sim, blockerSlot)
	if !g.dayChainsValid(blockerSlot.TeacherID, blockerSlot.StudentID, blockerSlot.Weekday, sim, ctx) {
		return false, nil
	}

	// Всё сошлось — коммитим: удаляем блокер, сохраняем оба занятия.
	if err := g.db.Delete(&models.ScheduleSlot{}, cand.blocker.ID).Error; err != nil {
		return false, err
	}
	g.removeSlotsFromContext([]models.ScheduleSlot{cand.blocker}, ctx)

	savedTask, err := g.SaveGeneratedSlot(scheduleID, CandidateSlot{
		AssignmentID: task.AssignmentID,
		StudentID:    task.StudentID,
		TeacherID:    task.TeacherID,
		SubjectID:    task.SubjectID,
		RoomID:       cand.roomID,
		Weekday:      cand.weekday,
		StartTime:    taskSlot.StartTime,
		EndTime:      taskSlot.EndTime,
	})
	if err != nil {
		return false, err
	}
	ctx.ExistingSlots = append(ctx.ExistingSlots, generatedSlotForContext(savedTask, task))

	savedBlocker, err := g.SaveGeneratedSlot(scheduleID, bestForBlocker)
	if err != nil {
		return false, err
	}
	ctx.ExistingSlots = append(ctx.ExistingSlots, generatedSlotForContext(savedBlocker, blockerTask))

	log.Printf("[GEN] relocation: task a=%d placed wd=%d %s; blocker a=%d moved to wd=%d %s",
		task.AssignmentID, cand.weekday, taskSlot.StartTime,
		blockerTask.AssignmentID, bestForBlocker.Weekday, bestForBlocker.StartTime)
	return true, nil
}

// dayChainsValid проверяет жёсткие лимиты перерывов дня после изменения:
// цепочку преподавателя и цепочку ученика (если указан).
func (g *ScheduleGenerator) dayChainsValid(
	teacherID uint,
	studentID *uint,
	weekday int,
	slots []models.ScheduleSlot,
	ctx *GenerationContext,
) bool {
	maxTeacherGap := g.teacherGapMinutes
	if maxTeacherGap < MinimumConfiguredGapMinutes {
		maxTeacherGap = MinimumConfiguredGapMinutes
	}
	var teacherIntervals [][2]int
	for _, s := range slots {
		if !slotHasTeacher(s, teacherID) || s.Weekday != weekday || s.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		start, end := hhmmToMinutes(s.StartTime), hhmmToMinutes(s.EndTime)
		if start >= 0 && end >= 0 {
			teacherIntervals = append(teacherIntervals, [2]int{start, end})
		}
	}
	if !intervalsGapsWithin(teacherIntervals, maxTeacherGap) {
		return false
	}

	if studentID == nil {
		return true
	}
	if ctx.StudentAllowsWindows[*studentID] {
		return true
	}
	var studentIntervals [][2]int
	for _, s := range slots {
		if s.Weekday != weekday || s.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		match := false
		if s.SlotType == models.SlotTypeGroup {
			if slotHasStudent(s, *studentID, ctx.GroupLessonEnrollments) {
				if s.GroupLesson != nil && s.GroupLesson.IgnoreStudentWindows {
					continue
				}
				match = true
			}
		} else if s.StudentID != nil && *s.StudentID == *studentID {
			match = true
		}
		if !match {
			continue
		}
		start, end := hhmmToMinutes(s.StartTime), hhmmToMinutes(s.EndTime)
		if start >= 0 && end >= 0 {
			studentIntervals = append(studentIntervals, [2]int{start, end})
		}
	}
	return intervalsGapsWithin(studentIntervals, g.maxStudentGapMinutes)
}

func intervalsGapsWithin(intervals [][2]int, maxGap int) bool {
	sort.Slice(intervals, func(i, j int) bool { return intervals[i][0] < intervals[j][0] })
	for i := 1; i < len(intervals); i++ {
		if intervals[i][0]-intervals[i-1][1] > maxGap {
			return false
		}
	}
	return true
}

func buildSimSlot(scheduleID uint, task WeeklyTask, weekday, startMin int, roomID uint) models.ScheduleSlot {
	assignmentID, studentID, subjectID, room := task.AssignmentID, task.StudentID, task.SubjectID, roomID
	return models.ScheduleSlot{
		ScheduleID:   scheduleID,
		SlotType:     models.SlotTypeIndividual,
		AssignmentID: &assignmentID,
		StudentID:    &studentID,
		TeacherID:    task.TeacherID,
		SubjectID:    &subjectID,
		RoomID:       &room,
		Weekday:      weekday,
		StartTime:    minutesToHHMM(startMin),
		EndTime:      minutesToHHMM(startMin + task.DurationMin),
		Origin:       models.ScheduleSlotOriginAuto,
		Status:       models.ScheduleSlotStatusScheduled,
		Subject:      &models.Subject{ID: task.SubjectID, MinimumTeacherBreakMinutes: task.MinimumTeacherBreakMinutes},
	}
}

func derefUint(v *uint) uint {
	if v == nil {
		return 0
	}
	return *v
}
