package handlers

import (
	"backend/internal/models"
	"backend/internal/services"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createConsultationFixture(t *testing.T, e *testEnv) (*models.Schedule, *models.Teacher, *models.Subject, *models.Room) {
	t.Helper()
	teacher := &models.Teacher{FullName: "Иванова Вера", IsActive: true}
	subject := &models.Subject{Name: "Консультация психолога", DefaultDurationMin: 30, IsActive: true}
	room := &models.Room{Name: "Кабинет психолога", IsActive: true}
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(subject).Error)
	require.NoError(t, e.db.Create(room).Error)
	require.NoError(t, e.db.Create(&models.TeacherSubject{TeacherID: teacher.ID, SubjectID: subject.ID}).Error)
	require.NoError(t, e.db.Create(&models.RoomSubject{RoomID: room.ID, SubjectID: subject.ID}).Error)

	weekStart := time.Date(2026, time.September, 28, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusDraft}
	require.NoError(t, e.db.Create(schedule).Error)
	return schedule, teacher, subject, room
}

func performCreateScheduleSlot(t *testing.T, h *ScheduleHandler, scheduleID uint, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: itoa(scheduleID)}}
	h.CreateScheduleSlot(c)
	return w
}

func TestCreateScheduleSlot_CreatesConsultationWithoutStudent(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	h := NewScheduleHandler(e.db, nil)

	w := performCreateScheduleSlot(t, h, schedule.ID, map[string]any{
		"slot_type":                         models.SlotTypeIndividual,
		"lesson_kind":                       models.ScheduleLessonKindConsultation,
		"teacher_id":                        teacher.ID,
		"subject_id":                        subject.ID,
		"room_id":                           room.ID,
		"guest_child_last_name":             "  Петров  ",
		"guest_child_first_name":            "Пётр",
		"guest_child_middle_name":           "Петрович",
		"weekday":                           2,
		"start_time":                        "10:40",
		"end_time":                          "11:10",
		"acknowledge_missing_report_tariff": true,
	})
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	var slot models.ScheduleSlot
	require.NoError(t, e.db.Where("schedule_id = ?", schedule.ID).First(&slot).Error)
	assert.True(t, slot.IsConsultation())
	assert.Nil(t, slot.AssignmentID)
	assert.Nil(t, slot.StudentID)
	assert.Nil(t, slot.GroupLessonID)
	assert.Equal(t, "Петров", slot.GuestChildLastName)
	assert.Equal(t, "Пётр", slot.GuestChildFirstName)
	assert.Equal(t, "Петрович", slot.GuestChildMiddleName)
	assert.Equal(t, "Петров Пётр Петрович", slot.GuestChildFullName())
	assert.Equal(t, models.ScheduleSlotOriginManual, slot.Origin)
}

func TestCreateScheduleSlot_RejectsExistingStudentForConsultation(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	student := &models.Student{FullName: "Существующий ребёнок", FundingType: models.FundingTypeBudget, IsActive: true}
	require.NoError(t, e.db.Create(student).Error)

	w := performCreateScheduleSlot(t, NewScheduleHandler(e.db, nil), schedule.ID, map[string]any{
		"slot_type":              models.SlotTypeIndividual,
		"lesson_kind":            models.ScheduleLessonKindConsultation,
		"student_id":             student.ID,
		"teacher_id":             teacher.ID,
		"subject_id":             subject.ID,
		"room_id":                room.ID,
		"guest_child_last_name":  "Петров",
		"guest_child_first_name": "Пётр",
		"weekday":                2,
		"start_time":             "10:40",
		"end_time":               "11:10",
	})
	require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
	assert.Contains(t, w.Body.String(), "существующего ребёнка")

	var count int64
	require.NoError(t, e.db.Model(&models.ScheduleSlot{}).Where("schedule_id = ?", schedule.ID).Count(&count).Error)
	assert.Zero(t, count)
}

func TestCleanupAutoSlots_PreservesAutoConsultation(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	consultation := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID, GuestChildLastName: "Петров", GuestChildFirstName: "Пётр",
		Weekday: 2, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginAuto, Status: models.ScheduleSlotStatusScheduled,
	}
	regular := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindRegular,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		Weekday: 3, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginAuto, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(consultation).Error)
	require.NoError(t, e.db.Create(regular).Error)

	require.NoError(t, services.NewScheduleGenerator(e.db).CleanupAutoSlots(schedule.ID))
	var remaining []models.ScheduleSlot
	require.NoError(t, e.db.Where("schedule_id = ?", schedule.ID).Find(&remaining).Error)
	require.Len(t, remaining, 1)
	assert.Equal(t, consultation.ID, remaining[0].ID)
	assert.True(t, remaining[0].IsConsultation())
}

func TestUpdateScheduleSlot_UpdatesConsultationWithoutCreatingStudentLink(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		GuestChildLastName: "Петров", GuestChildFirstName: "Пётр",
		Weekday: 2, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginAuto, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(slot).Error)

	payload, err := json.Marshal(map[string]any{
		"guest_child_last_name":   "Сидорова",
		"guest_child_first_name":  "Анна",
		"guest_child_middle_name": "Игоревна",
	})
	require.NoError(t, err)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: itoa(schedule.ID)}, {Key: "slotId", Value: itoa(slot.ID)}}
	NewScheduleHandler(e.db, nil).UpdateScheduleSlot(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var updated models.ScheduleSlot
	require.NoError(t, e.db.First(&updated, slot.ID).Error)
	assert.Equal(t, "Сидорова Анна Игоревна", updated.GuestChildFullName())
	assert.Nil(t, updated.StudentID)
	assert.Nil(t, updated.AssignmentID)
	assert.Equal(t, models.ScheduleSlotOriginManual, updated.Origin, "an edited auto slot follows the existing pin-on-edit rule")
}

func TestUpdateScheduleSlot_UpdatesAllConsultationFormFields(t *testing.T) {
	e := newTestEnv(t)
	schedule, firstTeacher, firstSubject, firstRoom := createConsultationFixture(t, e)
	secondTeacher := &models.Teacher{FullName: "Смирнова Анна", IsActive: true}
	secondSubject := &models.Subject{Name: "Логопед", DefaultDurationMin: 50, IsActive: true}
	secondRoom := &models.Room{Name: "Кабинет логопеда", IsActive: true}
	require.NoError(t, e.db.Create(secondTeacher).Error)
	require.NoError(t, e.db.Create(secondSubject).Error)
	require.NoError(t, e.db.Create(secondRoom).Error)
	require.NoError(t, e.db.Create(&models.TeacherSubject{TeacherID: secondTeacher.ID, SubjectID: secondSubject.ID}).Error)
	require.NoError(t, e.db.Create(&models.RoomSubject{RoomID: secondRoom.ID, SubjectID: secondSubject.ID}).Error)

	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: firstTeacher.ID, SubjectID: &firstSubject.ID, RoomID: &firstRoom.ID,
		GuestChildLastName: "Петров", GuestChildFirstName: "Пётр",
		Weekday: 2, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(slot).Error)

	payload, err := json.Marshal(map[string]any{
		"weekday": 3, "start_time": "12:00", "end_time": "12:50", "status": models.ScheduleSlotStatusMoved,
		"teacher_id": secondTeacher.ID, "subject_id": secondSubject.ID, "room_id": secondRoom.ID,
		"guest_child_last_name": "Сидорова", "guest_child_first_name": "Анна", "guest_child_middle_name": "Игоревна",
		"acknowledge_missing_report_tariff": true,
	})
	require.NoError(t, err)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: itoa(schedule.ID)}, {Key: "slotId", Value: itoa(slot.ID)}}
	NewScheduleHandler(e.db, nil).UpdateScheduleSlot(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var updated models.ScheduleSlot
	require.NoError(t, e.db.First(&updated, slot.ID).Error)
	assert.Equal(t, secondTeacher.ID, updated.TeacherID)
	require.NotNil(t, updated.SubjectID)
	assert.Equal(t, secondSubject.ID, *updated.SubjectID)
	require.NotNil(t, updated.RoomID)
	assert.Equal(t, secondRoom.ID, *updated.RoomID)
	assert.Equal(t, 3, updated.Weekday)
	assert.Equal(t, "12:00", updated.StartTime)
	assert.Equal(t, "12:50", updated.EndTime)
	assert.Equal(t, models.ScheduleSlotStatusMoved, updated.Status)
	assert.Equal(t, "Сидорова Анна Игоревна", updated.GuestChildFullName())
	assert.Nil(t, updated.StudentID)
	assert.Nil(t, updated.AssignmentID)
}

func TestUpdateScheduleSlot_CanCancelConsultationWithInactiveReferences(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		GuestChildLastName: "Петров", GuestChildFirstName: "Пётр",
		Weekday: 2, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(slot).Error)
	require.NoError(t, e.db.Model(teacher).Update("is_active", false).Error)
	require.NoError(t, e.db.Model(subject).Update("is_active", false).Error)
	require.NoError(t, e.db.Model(room).Update("is_active", false).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/", bytes.NewBufferString(`{"status":"cancelled"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: itoa(schedule.ID)}, {Key: "slotId", Value: itoa(slot.ID)}}
	NewScheduleHandler(e.db, nil).UpdateScheduleSlot(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var updated models.ScheduleSlot
	require.NoError(t, e.db.First(&updated, slot.ID).Error)
	assert.Equal(t, models.ScheduleSlotStatusCancelled, updated.Status)
	assert.Equal(t, models.ScheduleSlotOriginManual, updated.Origin)
}

func TestApproveSchedule_AllowsCancelledConsultationWithInactiveReferences(t *testing.T) {
	e := newTestEnv(t)
	schedule, teacher, subject, room := createConsultationFixture(t, e)
	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		GuestChildLastName: "Петров", GuestChildFirstName: "Пётр",
		Weekday: 2, StartTime: "10:40", EndTime: "11:10", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusCancelled,
	}
	require.NoError(t, e.db.Create(slot).Error)
	require.NoError(t, e.db.Model(teacher).Update("is_active", false).Error)
	require.NoError(t, e.db.Model(subject).Update("is_active", false).Error)
	require.NoError(t, e.db.Model(room).Update("is_active", false).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: itoa(schedule.ID)}}
	NewScheduleHandler(e.db, nil).ApproveSchedule(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var approved models.Schedule
	require.NoError(t, e.db.First(&approved, schedule.ID).Error)
	assert.Equal(t, models.ScheduleStatusApproved, approved.Status)
	assert.NotNil(t, approved.ApprovedAt)
}

func TestCopyManualSlotsFromPrevWeek_DoesNotCopyConsultations(t *testing.T) {
	e := newTestEnv(t)
	previous, teacher, subject, room := createConsultationFixture(t, e)
	current := &models.Schedule{
		WeekStartDate: previous.WeekStartDate.AddDate(0, 0, 7),
		WeekEndDate:   previous.WeekEndDate.AddDate(0, 0, 7),
		Status:        models.ScheduleStatusDraft,
	}
	require.NoError(t, e.db.Create(current).Error)
	student := &models.Student{FullName: "Ученик для копирования", FundingType: models.FundingTypeBudget, IsActive: true}
	require.NoError(t, e.db.Create(student).Error)
	assignment := &models.Assignment{
		StudentID: student.ID, TeacherID: teacher.ID, SubjectID: subject.ID,
		FundingType: models.FundingTypeBudget, VisitsPerWeek: 1, DurationMin: 30, Status: models.AssignmentStatusActive,
	}
	require.NoError(t, e.db.Create(assignment).Error)
	consultation := &models.ScheduleSlot{
		ScheduleID: previous.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindConsultation,
		TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		GuestChildLastName: "Гостев", GuestChildFirstName: "Ребёнок",
		Weekday: 2, StartTime: "10:00", EndTime: "10:30", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	regular := &models.ScheduleSlot{
		ScheduleID: previous.ID, SlotType: models.SlotTypeIndividual, LessonKind: models.ScheduleLessonKindRegular,
		AssignmentID: &assignment.ID, StudentID: &student.ID, TeacherID: teacher.ID, SubjectID: &subject.ID, RoomID: &room.ID,
		Weekday: 3, StartTime: "10:00", EndTime: "10:30", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(consultation).Error)
	require.NoError(t, e.db.Create(regular).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: itoa(current.ID)}}
	NewScheduleHandler(e.db, nil).CopyManualSlotsFromPrevWeek(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var copied []models.ScheduleSlot
	require.NoError(t, e.db.Where("schedule_id = ?", current.ID).Find(&copied).Error)
	require.Len(t, copied, 1)
	assert.Equal(t, models.ScheduleLessonKindRegular, copied[0].LessonKind)
	assert.Equal(t, student.ID, *copied[0].StudentID)
}

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
