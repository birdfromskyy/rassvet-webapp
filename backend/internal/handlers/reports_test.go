package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStudentReport_GroupLessonIncludesOnlySelectedStudentInSummary(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	selected := &models.Student{FullName: "Малахов Владимир", FundingType: "budget", IsActive: true}
	peer := &models.Student{FullName: "Мурашов Данила", FundingType: "budget", IsActive: true}
	require.NoError(t, e.db.Create(selected).Error)
	require.NoError(t, e.db.Create(peer).Error)

	teacher := &models.Teacher{FullName: "Тестовый преподаватель", IsActive: true}
	subject := &models.Subject{Name: "Музыкальное занятие", DefaultDurationMin: 60, IsActive: true}
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(subject).Error)

	group := &models.GroupLesson{
		Name: "Музыкальное занятие", SubjectID: &subject.ID, DefaultTeacherID: &teacher.ID,
		VisitsPerWeek: 1, DurationMin: 60, MaxStudents: 10, Status: models.GroupLessonStatusActive,
	}
	require.NoError(t, e.db.Create(group).Error)
	require.NoError(t, e.db.Create(&models.GroupLessonEnrollment{GroupLessonID: group.ID, StudentID: selected.ID}).Error)
	require.NoError(t, e.db.Create(&models.GroupLessonEnrollment{GroupLessonID: group.ID, StudentID: peer.ID}).Error)

	weekStart := time.Date(2026, time.July, 6, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{
		WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusApproved,
	}
	require.NoError(t, e.db.Create(schedule).Error)
	require.NoError(t, e.db.Create(&models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeGroup, GroupLessonID: &group.ID,
		TeacherID: teacher.ID, SubjectID: &subject.ID, Weekday: 2, StartTime: "14:30", EndTime: "15:30",
		Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}).Error)

	cookies := e.login(t, "admin@test.ru", "Passw0rd")
	w := e.do(http.MethodGet, "/api/admin/reports/monthly?start_date=2026-07-07&end_date=2026-07-07&student_id="+itoa(selected.ID), "", cookies)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var report struct {
		Students []monthlyStudentReportRow `json:"students"`
		Lessons  []reportLessonRow         `json:"lessons"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	require.Len(t, report.Students, 1)
	assert.Equal(t, selected.ID, report.Students[0].StudentID)
	assert.Equal(t, 1, report.Students[0].Lessons)
	require.Len(t, report.Lessons, 1)
	assert.ElementsMatch(t, []uint{selected.ID, peer.ID}, report.Lessons[0].StudentIDs)
}

func itoa(id uint) string {
	return fmt.Sprintf("%d", id)
}
