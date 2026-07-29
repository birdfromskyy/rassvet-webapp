package handlers

import (
	"backend/internal/models"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeleteGroupScheduleSlot_RemovesTeacherAndAttendanceLinks(t *testing.T) {
	e := newTestEnv(t)
	teacher := &models.Teacher{FullName: "Тестовый преподаватель", IsActive: true}
	student := &models.Student{FullName: "Тестовый ученик", FundingType: "budget", IsActive: true}
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(student).Error)

	weekStart := time.Date(2026, time.August, 17, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusDraft}
	require.NoError(t, e.db.Create(schedule).Error)
	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeGroup, TeacherID: teacher.ID,
		Weekday: 1, StartTime: "10:00", EndTime: "11:00", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(slot).Error)
	require.NoError(t, e.db.Create([]models.ScheduleSlotTeacher{
		{ScheduleSlotID: slot.ID, TeacherID: teacher.ID},
	}).Error)
	require.NoError(t, e.db.Create(&models.GroupLessonAttendance{ScheduleSlotID: slot.ID, StudentID: student.ID}).Error)

	h := NewScheduleHandler(e.db, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: itoa(schedule.ID)}, {Key: "slotId", Value: itoa(slot.ID)}}
	h.DeleteScheduleSlot(c)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var slotCount, teacherLinkCount, attendanceCount int64
	e.db.Model(&models.ScheduleSlot{}).Where("id = ?", slot.ID).Count(&slotCount)
	e.db.Model(&models.ScheduleSlotTeacher{}).Where("schedule_slot_id = ?", slot.ID).Count(&teacherLinkCount)
	e.db.Model(&models.GroupLessonAttendance{}).Where("schedule_slot_id = ?", slot.ID).Count(&attendanceCount)
	assert.Zero(t, slotCount)
	assert.Zero(t, teacherLinkCount)
	assert.Zero(t, attendanceCount)
}

func TestMultiTeacherGroupSlot_DoesNotConflictWithItself(t *testing.T) {
	e := newTestEnv(t)
	firstTeacher := &models.Teacher{FullName: "Первый преподаватель", IsActive: true}
	secondTeacher := &models.Teacher{FullName: "Второй преподаватель", IsActive: true}
	require.NoError(t, e.db.Create(firstTeacher).Error)
	require.NoError(t, e.db.Create(secondTeacher).Error)

	group := &models.GroupLesson{Name: "Группа", VisitsPerWeek: 1, DurationMin: 60, MaxStudents: 10, Status: models.GroupLessonStatusActive}
	require.NoError(t, e.db.Create(group).Error)

	previousWeek := time.Date(2026, time.August, 17, 0, 0, 0, 0, time.UTC)
	previousSchedule := &models.Schedule{WeekStartDate: previousWeek, WeekEndDate: previousWeek.AddDate(0, 0, 6), Status: models.ScheduleStatusDraft}
	currentSchedule := &models.Schedule{WeekStartDate: previousWeek.AddDate(0, 0, 7), WeekEndDate: previousWeek.AddDate(0, 0, 13), Status: models.ScheduleStatusDraft}
	require.NoError(t, e.db.Create(previousSchedule).Error)
	require.NoError(t, e.db.Create(currentSchedule).Error)

	sourceSlot := &models.ScheduleSlot{
		ScheduleID: previousSchedule.ID, SlotType: models.SlotTypeGroup, GroupLessonID: &group.ID, TeacherID: firstTeacher.ID,
		Weekday: 1, StartTime: "10:00", EndTime: "11:00", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(sourceSlot).Error)
	require.NoError(t, e.db.Create([]models.ScheduleSlotTeacher{
		{ScheduleSlotID: sourceSlot.ID, TeacherID: firstTeacher.ID},
		{ScheduleSlotID: sourceSlot.ID, TeacherID: secondTeacher.ID},
	}).Error)

	// Simulate the state immediately after CopyManualSlotsFromPrevWeek has
	// inserted a group slot and restored its complete teacher snapshot.
	copiedSlot := &models.ScheduleSlot{
		ScheduleID: currentSchedule.ID, SlotType: models.SlotTypeGroup, GroupLessonID: &group.ID, TeacherID: firstTeacher.ID,
		Weekday: 1, StartTime: "10:00", EndTime: "11:00", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(copiedSlot).Error)
	require.NoError(t, e.db.Create([]models.ScheduleSlotTeacher{
		{ScheduleSlotID: copiedSlot.ID, TeacherID: firstTeacher.ID},
		{ScheduleSlotID: copiedSlot.ID, TeacherID: secondTeacher.ID},
	}).Error)

	h := NewScheduleHandler(e.db, nil)
	require.NoError(t, h.ensureSlotHasNoConflictsWithDB(e.db, *copiedSlot, copiedSlot.ID))

	var sourceCount, copiedCount int64
	e.db.Model(&models.ScheduleSlot{}).Where("schedule_id = ?", previousSchedule.ID).Count(&sourceCount)
	e.db.Model(&models.ScheduleSlot{}).Where("schedule_id = ?", currentSchedule.ID).Count(&copiedCount)
	assert.EqualValues(t, 1, sourceCount, "a slot from another week must not participate in conflict checks")
	assert.EqualValues(t, 1, copiedCount)
	var copiedTeacherLinks int64
	e.db.Model(&models.ScheduleSlotTeacher{}).Where("schedule_slot_id = ?", copiedSlot.ID).Count(&copiedTeacherLinks)
	assert.EqualValues(t, 2, copiedTeacherLinks)
}

func TestCountRequestedVisitsIncludesActiveGroupLessons(t *testing.T) {
	e := newTestEnv(t)
	student := &models.Student{FullName: "Ученик", FundingType: models.FundingTypeBudget, IsActive: true}
	teacher := &models.Teacher{FullName: "Преподаватель", IsActive: true}
	subject := &models.Subject{Name: "Предмет", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(student).Error)
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(subject).Error)
	require.NoError(t, e.db.Create(&models.Assignment{
		StudentID: student.ID, TeacherID: teacher.ID, SubjectID: subject.ID,
		FundingType: models.FundingTypeBudget, VisitsPerWeek: 2, DurationMin: 30,
		Status: models.AssignmentStatusActive,
	}).Error)
	require.NoError(t, e.db.Create(&models.GroupLesson{
		Name: "Активная группа", VisitsPerWeek: 3, DurationMin: 60, MaxStudents: 10,
		Status: models.GroupLessonStatusActive,
	}).Error)
	require.NoError(t, e.db.Create(&models.GroupLesson{
		Name: "Группа на паузе", VisitsPerWeek: 5, DurationMin: 60, MaxStudents: 10,
		Status: models.GroupLessonStatusPaused,
	}).Error)

	individual, group := NewScheduleHandler(e.db, nil).countRequestedVisitsFromSchedule(&models.Schedule{})
	assert.Equal(t, 2, individual)
	assert.Equal(t, 3, group)
}
