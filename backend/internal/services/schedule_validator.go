package services

import (
	"backend/internal/models"
	"strings"
)

type ScheduleValidator struct{}

func NewScheduleValidator() *ScheduleValidator {
	return &ScheduleValidator{}
}

func (v *ScheduleValidator) IsTeacherAvailable(
	teacherID uint,
	weekday int,
	startTime string,
	endTime string,
	availability []models.TeacherAvailability,
) bool {
	for _, slot := range availability {
		if slot.TeacherID != teacherID {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if startTime >= slot.StartTime && endTime <= slot.EndTime {
			return true
		}
	}
	return false
}

func (v *ScheduleValidator) IsStudentAvailable(
	studentID uint,
	weekday int,
	startTime string,
	endTime string,
	availability []models.StudentAvailability,
) bool {
	for _, slot := range availability {
		if slot.StudentID != studentID {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if startTime >= slot.StartTime && endTime <= slot.EndTime {
			return true
		}
	}
	return false
}

func (v *ScheduleValidator) IsRoomAllowedForSubject(
	roomID uint,
	subjectID uint,
	roomSubjects []models.RoomSubject,
) bool {
	for _, rs := range roomSubjects {
		if rs.RoomID == roomID && rs.SubjectID == subjectID {
			return true
		}
	}
	return false
}

func (v *ScheduleValidator) HasTeacherConflict(
	teacherID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
) bool {
	for _, slot := range existingSlots {
		if !slotHasTeacher(slot, teacherID) {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if timesOverlap(startTime, endTime, slot.StartTime, slot.EndTime) {
			return true
		}
	}
	return false
}

// HasStudentConflict проверяет конфликт ученика с учётом индивидуальных и групповых слотов.
func (v *ScheduleValidator) HasStudentConflict(
	studentID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
	enrollments []models.GroupLessonEnrollment,
) bool {
	for _, slot := range existingSlots {
		if slot.Weekday != weekday {
			continue
		}
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		if slot.SlotType == models.SlotTypeGroup {
			if !slotHasStudent(slot, studentID, enrollments) {
				continue
			}
		} else {
			if slot.StudentID == nil || *slot.StudentID != studentID {
				continue
			}
		}

		if timesOverlap(startTime, endTime, slot.StartTime, slot.EndTime) {
			return true
		}
	}
	return false
}

func (v *ScheduleValidator) HasRoomConflict(
	roomID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
) bool {
	for _, slot := range existingSlots {
		if slot.RoomID == nil || *slot.RoomID != roomID {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		if timesOverlap(startTime, endTime, slot.StartTime, slot.EndTime) {
			return true
		}
	}
	return false
}

func (v *ScheduleValidator) ViolatesSameDayRule(
	assignmentID uint,
	weekday int,
	existingSlots []models.ScheduleSlot,
) bool {
	for _, slot := range existingSlots {
		if slot.AssignmentID == nil || *slot.AssignmentID != assignmentID {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}
		return true
	}
	return false
}

func (v *ScheduleValidator) ViolatesSameSubjectConsecutiveRule(
	studentID uint,
	subjectID uint,
	weekday int,
	startTime string,
	endTime string,
	existingSlots []models.ScheduleSlot,
	enrollments []models.GroupLessonEnrollment,
) bool {
	for _, slot := range existingSlots {
		if slot.SubjectID == nil || *slot.SubjectID != subjectID {
			continue
		}
		if slot.Weekday != weekday {
			continue
		}
		if slot.Status == models.ScheduleSlotStatusCancelled {
			continue
		}

		if slot.SlotType == models.SlotTypeGroup {
			if !slotHasStudent(slot, studentID, enrollments) {
				continue
			}
		} else {
			if slot.StudentID == nil || *slot.StudentID != studentID {
				continue
			}
		}

		// Any lesson of the same subject on the same day is a violation —
		// regardless of whether the times are adjacent or far apart.
		return true
	}
	return false
}

func (v *ScheduleValidator) ApplyBreakBuffer(
	startTime string,
	endTime string,
	breakMin int,
) (string, string) {
	if breakMin <= 0 {
		return startTime, endTime
	}

	startMinutes := hhmmToMinutes(startTime)
	endMinutes := hhmmToMinutes(endTime)

	if startMinutes < 0 || endMinutes < 0 {
		return startTime, endTime
	}

	bufferedStart := startMinutes - breakMin
	if bufferedStart < 0 {
		bufferedStart = 0
	}

	bufferedEnd := endMinutes + breakMin
	if bufferedEnd > 23*60+59 {
		bufferedEnd = 23*60 + 59
	}

	return minutesToHHMM(bufferedStart), minutesToHHMM(bufferedEnd)
}

func isStudentEnrolledInGroup(studentID uint, groupLessonID uint, enrollments []models.GroupLessonEnrollment) bool {
	for _, e := range enrollments {
		if e.GroupLessonID == groupLessonID && e.StudentID == studentID {
			return true
		}
	}
	return false
}

func timesOverlap(startA, endA, startB, endB string) bool {
	return startA < endB && startB < endA
}

func gapMinutes(endA, startB string) int {
	endAMin := hhmmToMinutes(endA)
	startBMin := hhmmToMinutes(startB)
	if endAMin < 0 || startBMin < 0 {
		return -1
	}
	return startBMin - endAMin
}

func hhmmToMinutes(value string) int {
	if len(value) != 5 || value[2] != ':' {
		return -1
	}

	hours := toInt(value[:2])
	minutes := toInt(value[3:])
	if hours < 0 || minutes < 0 {
		return -1
	}

	if hours > 23 || minutes > 59 {
		return -1
	}

	return hours*60 + minutes
}

func minutesToHHMM(value int) string {
	if value < 0 {
		value = 0
	}

	hours := value / 60
	minutes := value % 60

	return twoDigits(hours) + ":" + twoDigits(minutes)
}

func toInt(value string) int {
	value = strings.TrimSpace(value)
	if len(value) == 0 {
		return -1
	}

	result := 0
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return -1
		}
		result = result*10 + int(ch-'0')
	}
	return result
}

func twoDigits(value int) string {
	if value < 10 {
		return "0" + string(rune('0'+value))
	}
	if value < 100 {
		tens := value / 10
		ones := value % 10
		return string(rune('0'+tens)) + string(rune('0'+ones))
	}
	return "00"
}
