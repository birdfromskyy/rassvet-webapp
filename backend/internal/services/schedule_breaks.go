package services

import "backend/internal/models"

// violatesMinimumBreak enforces automatic scheduling rest rules. It is
// directional: the break after a lesson is determined by the lesson that has
// just ended. Group lessons always give their teachers ten minutes; every
// student gets five minutes. Manual schedule editing deliberately does not use
// this function, so an administrator can make rare explicit exceptions.
func (g *ScheduleGenerator) violatesMinimumBreak(task WeeklyTask, weekday int, startTime, endTime string, slots []models.ScheduleSlot, ctx *GenerationContext) bool {
	start, end := hhmmToMinutes(startTime), hhmmToMinutes(endTime)
	if start < 0 || end < 0 {
		return true
	}
	for _, slot := range slots {
		if slot.Weekday != weekday || slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		slotStart, slotEnd := hhmmToMinutes(slot.StartTime), hhmmToMinutes(slot.EndTime)
		if slotStart < 0 || slotEnd < 0 {
			continue
		}

		if slotHasTeacher(slot, task.TeacherID) {
			required := task.MinimumTeacherBreakMinutes
			gap := 0
			if slotEnd <= start {
				required = minimumBreakAfterSlot(slot, ctx)
				gap = start - slotEnd
			} else if end <= slotStart {
				gap = slotStart - end
			} else {
				continue
			}
			if isSameIndividualTeacherStudentChain(slot, task, gap) {
				continue
			}
			if gap < required {
				return true
			}
		}

		if slotHasStudent(slot, task.StudentID, ctx.GroupLessonEnrollments) {
			gap := 0
			if slotEnd <= start {
				gap = start - slotEnd
			} else if end <= slotStart {
				gap = slotStart - end
			} else {
				continue
			}
			if isSameIndividualTeacherStudentChain(slot, task, gap) {
				continue
			}
			if gap < 5 {
				return true
			}
		}
	}
	return false
}

func minimumBreakAfterSlot(slot models.ScheduleSlot, ctx *GenerationContext) int {
	if slot.SlotType == models.SlotTypeGroup {
		return 10
	}
	// Existing individual slots do not store a duration-independent break
	// snapshot. The subject's current setting is applied to future generation;
	// absent subject data falls back safely to ten minutes.
	if slot.Subject != nil && slot.Subject.MinimumTeacherBreakMinutes == 5 {
		return 5
	}
	if slot.SubjectID != nil && ctx != nil && ctx.SubjectMinimumTeacherBreak[*slot.SubjectID] == 5 {
		return 5
	}
	return 10
}

// generatedSlotForContext preserves the subject break rule while the generator
// evaluates later candidates in the same run. Persisted slots are intentionally
// not changed: the source of truth remains the subject setting.
func generatedSlotForContext(slot *models.ScheduleSlot, task WeeklyTask) models.ScheduleSlot {
	contextSlot := *slot
	contextSlot.Subject = &models.Subject{ID: task.SubjectID, MinimumTeacherBreakMinutes: task.MinimumTeacherBreakMinutes}
	return contextSlot
}

func slotHasTeacher(slot models.ScheduleSlot, teacherID uint) bool {
	if slot.SlotType == models.SlotTypeGroup && len(slot.Teachers) > 0 {
		for _, link := range slot.Teachers {
			if link.TeacherID == teacherID {
				return true
			}
		}
		return false
	}
	return slot.TeacherID == teacherID
}

func slotHasStudent(slot models.ScheduleSlot, studentID uint, enrollments []models.GroupLessonEnrollment) bool {
	if slot.SlotType != models.SlotTypeGroup {
		return slot.StudentID != nil && *slot.StudentID == studentID
	}
	if len(slot.GroupLessonAttendance) > 0 {
		for _, attendance := range slot.GroupLessonAttendance {
			if attendance.StudentID == studentID {
				return true
			}
		}
		return false
	}
	return slot.GroupLessonID != nil && isStudentEnrolledInGroup(studentID, *slot.GroupLessonID, enrollments)
}

func isSameIndividualTeacherStudentChain(slot models.ScheduleSlot, task WeeklyTask, gap int) bool {
	return gap == 0 && slot.SlotType == models.SlotTypeIndividual && slot.StudentID != nil &&
		*slot.StudentID == task.StudentID && slot.TeacherID == task.TeacherID
}
