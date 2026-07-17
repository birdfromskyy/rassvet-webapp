package services

import (
	"backend/internal/models"
	"testing"

	"github.com/stretchr/testify/assert"
)

func uintRef(value uint) *uint { return &value }

func TestMinimumBreak_UsesCompletedSubjectAndAllowsOnlySameChildChain(t *testing.T) {
	generator := &ScheduleGenerator{}
	teacherID, firstStudentID, secondStudentID := uint(1), uint(10), uint(11)
	minimumTen := &models.Subject{MinimumTeacherBreakMinutes: 10}
	previous := models.ScheduleSlot{
		SlotType: models.SlotTypeIndividual, TeacherID: teacherID, StudentID: uintRef(firstStudentID),
		Weekday: 1, StartTime: "10:00", EndTime: "10:30", Subject: minimumTen,
	}
	ctx := &GenerationContext{}
	differentChild := WeeklyTask{TeacherID: teacherID, StudentID: secondStudentID, MinimumTeacherBreakMinutes: 5}

	assert.True(t, generator.violatesMinimumBreak(differentChild, 1, "10:35", "11:05", []models.ScheduleSlot{previous}, ctx))
	assert.False(t, generator.violatesMinimumBreak(differentChild, 1, "10:40", "11:10", []models.ScheduleSlot{previous}, ctx))

	sameChild := WeeklyTask{TeacherID: teacherID, StudentID: firstStudentID, MinimumTeacherBreakMinutes: 10}
	assert.False(t, generator.violatesMinimumBreak(sameChild, 1, "10:30", "11:00", []models.ScheduleSlot{previous}, ctx))
}

func TestMinimumBreak_UsesSubjectPolicyForGeneratedSlots(t *testing.T) {
	generator := &ScheduleGenerator{teacherGapMinutes: 10}
	teacherID, subjectID := uint(1), uint(5)
	previous := models.ScheduleSlot{
		SlotType: models.SlotTypeIndividual, TeacherID: teacherID, SubjectID: uintRef(subjectID),
		Weekday: 1, StartTime: "10:00", EndTime: "10:30",
	}
	ctx := &GenerationContext{SubjectMinimumTeacherBreak: map[uint]int{subjectID: 5}}
	task := WeeklyTask{TeacherID: teacherID, StudentID: 20, MinimumTeacherBreakMinutes: 10}

	assert.False(t, generator.violatesMinimumBreak(task, 1, "10:35", "11:05", []models.ScheduleSlot{previous}, ctx))
	assert.True(t, generator.hasValidTeacherGap(teacherID, 1, "10:35", "11:05", []models.ScheduleSlot{previous}))
}

func TestMinimumBreak_GroupRequiresTenMinutesForEveryLinkedTeacher(t *testing.T) {
	generator := &ScheduleGenerator{}
	firstTeacherID, secondTeacherID, studentID := uint(1), uint(2), uint(10)
	group := models.ScheduleSlot{
		SlotType: models.SlotTypeGroup, TeacherID: firstTeacherID, Weekday: 1, StartTime: "10:00", EndTime: "11:00",
		Teachers:              []models.ScheduleSlotTeacher{{TeacherID: firstTeacherID}, {TeacherID: secondTeacherID}},
		GroupLessonAttendance: []models.GroupLessonAttendance{{StudentID: studentID}},
	}
	ctx := &GenerationContext{}
	task := WeeklyTask{TeacherID: secondTeacherID, StudentID: 20, MinimumTeacherBreakMinutes: 5}

	assert.True(t, generator.violatesMinimumBreak(task, 1, "11:05", "11:35", []models.ScheduleSlot{group}, ctx))
	assert.False(t, generator.violatesMinimumBreak(task, 1, "11:10", "11:40", []models.ScheduleSlot{group}, ctx))
	assert.True(t, generator.violatesMinimumBreak(WeeklyTask{TeacherID: 3, StudentID: studentID, MinimumTeacherBreakMinutes: 5}, 1, "11:04", "11:34", []models.ScheduleSlot{group}, ctx))
}

func TestScheduleValidator_SeesAdditionalGroupTeacher(t *testing.T) {
	validator := NewScheduleValidator()
	slot := models.ScheduleSlot{
		SlotType: models.SlotTypeGroup, TeacherID: 1, Weekday: 1, StartTime: "10:00", EndTime: "11:00",
		Teachers: []models.ScheduleSlotTeacher{{TeacherID: 1}, {TeacherID: 2}},
	}

	assert.True(t, validator.HasTeacherConflict(2, 1, "10:30", "11:30", []models.ScheduleSlot{slot}))
}

func TestCreatesLargeStudentGap_RespectsAllowScheduleWindows(t *testing.T) {
	generator := &ScheduleGenerator{maxStudentGapMinutes: 10}
	slot := models.ScheduleSlot{SlotType: models.SlotTypeIndividual, StudentID: uintRef(1), Weekday: 1, StartTime: "10:00", EndTime: "10:30"}

	assert.True(t, generator.createsLargeStudentGap(1, 1, "11:00", "11:30", []models.ScheduleSlot{slot}, nil, false))
	assert.False(t, generator.createsLargeStudentGap(1, 1, "11:00", "11:30", []models.ScheduleSlot{slot}, nil, true))
}
