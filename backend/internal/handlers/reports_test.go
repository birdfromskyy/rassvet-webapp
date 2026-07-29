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

func TestTeacherReport_GroupLessonSplitRoundsEachTeacherCredit(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	first := &models.Teacher{FullName: "Жуковская", IsActive: true}
	second := &models.Teacher{FullName: "Зубова", IsActive: true}
	third := &models.Teacher{FullName: "Стрелов", IsActive: true}
	subject := &models.Subject{Name: "Музыкальное занятие", DefaultDurationMin: 50, MinimumTeacherBreakMinutes: 10, IsActive: true}
	require.NoError(t, e.db.Create(first).Error)
	require.NoError(t, e.db.Create(second).Error)
	require.NoError(t, e.db.Create(third).Error)
	require.NoError(t, e.db.Create(subject).Error)

	weekStart := time.Date(2026, time.July, 6, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusApproved}
	require.NoError(t, e.db.Create(schedule).Error)
	mode := models.TeacherHoursModeSplit
	slot := &models.ScheduleSlot{ScheduleID: schedule.ID, SlotType: models.SlotTypeGroup, TeacherID: first.ID, SubjectID: &subject.ID, Weekday: 2, StartTime: "10:00", EndTime: "11:00", Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled, TeacherHoursMode: &mode}
	require.NoError(t, e.db.Create(slot).Error)
	require.NoError(t, e.db.Create([]models.ScheduleSlotTeacher{
		{ScheduleSlotID: slot.ID, TeacherID: first.ID},
		{ScheduleSlotID: slot.ID, TeacherID: second.ID},
		{ScheduleSlotID: slot.ID, TeacherID: third.ID},
	}).Error)

	cookies := e.login(t, "admin@test.ru", "Passw0rd")
	w := e.do(http.MethodGet, "/api/admin/reports/monthly?start_date=2026-07-07&end_date=2026-07-07", "", cookies)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var report struct {
		Teachers []monthlyTeacherReportRow `json:"teachers"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	require.Len(t, report.Teachers, 3)
	for _, row := range report.Teachers {
		assert.Equal(t, 1, row.Lessons)
		assert.Equal(t, 0.5, row.Hours, "60 / 3 = 20 minutes rounds to 0.5 hours per teacher")
	}
}

func TestStudentReport_UsesCurrentTariffRuleWithoutChangingSchedule(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	student := &models.Student{FullName: "Иванова Анна", FundingType: "budget", IsActive: true}
	teacher := &models.Teacher{FullName: "Тестовый преподаватель", IsActive: true}
	subject := &models.Subject{Name: "Сенсорная интеграция", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(student).Error)
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(subject).Error)

	price := 1410
	duration := 30
	tariff := &models.CommercialTariff{
		ServiceName: "Индивидуальное занятие по сенсорной интеграции",
		VolumeLabel: "30 мин", DurationMinutes: &duration, PriceRub: &price,
		EffectiveFrom: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), IsActive: true,
	}
	require.NoError(t, e.db.Create(tariff).Error)
	require.NoError(t, e.db.Create(&models.ReportTariffRule{
		SubjectID: &subject.ID, SlotType: models.SlotTypeIndividual, DurationMinutes: duration,
		CommercialTariffID: tariff.ID, IsActive: true,
	}).Error)

	weekStart := time.Date(2026, time.July, 6, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusApproved}
	require.NoError(t, e.db.Create(schedule).Error)
	slot := &models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeIndividual, TeacherID: teacher.ID,
		StudentID: &student.ID, SubjectID: &subject.ID, Weekday: 2, StartTime: "10:00", EndTime: "10:30",
		Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}
	require.NoError(t, e.db.Create(slot).Error)

	cookies := e.login(t, "admin@test.ru", "Passw0rd")
	w := e.do(http.MethodGet, "/api/admin/reports/monthly?start_date=2026-07-07&end_date=2026-07-07", "", cookies)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var report struct {
		Students       []monthlyStudentReportRow `json:"students"`
		StudentTotals  []monthlyStudentTotalRow  `json:"student_totals"`
		Lessons        []reportLessonRow         `json:"lessons"`
		TotalAmountRub int                       `json:"total_amount_rub"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	require.Len(t, report.Students, 1)
	assert.Equal(t, price, report.Students[0].TariffRub)
	assert.Equal(t, price, report.Students[0].AmountRub)
	require.Len(t, report.StudentTotals, 1)
	assert.Equal(t, price, report.StudentTotals[0].AmountRub)
	require.Len(t, report.Lessons, 1)
	assert.Equal(t, price, report.Lessons[0].TariffRub)
	assert.Equal(t, price, report.Lessons[0].AmountRub)
	assert.Equal(t, price, report.TotalAmountRub)

	var unchanged models.ScheduleSlot
	require.NoError(t, e.db.First(&unchanged, slot.ID).Error)
	assert.Equal(t, "10:00", unchanged.StartTime)
	assert.Equal(t, "10:30", unchanged.EndTime)
}

func TestStudentReport_GroupTariffIsAppliedToEveryChild(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	firstStudent := &models.Student{FullName: "Алексеева Мария", FundingType: "budget", IsActive: true}
	secondStudent := &models.Student{FullName: "Борисов Пётр", FundingType: "commercial", IsActive: true}
	teacher := &models.Teacher{FullName: "Тестовый преподаватель", IsActive: true}
	subject := &models.Subject{Name: "Групповое занятие для тарифа", DefaultDurationMin: 60, IsActive: true}
	require.NoError(t, e.db.Create(firstStudent).Error)
	require.NoError(t, e.db.Create(secondStudent).Error)
	require.NoError(t, e.db.Create(teacher).Error)
	require.NoError(t, e.db.Create(subject).Error)

	// The migrated test database may contain default group rules. Remove them
	// only inside this test transaction, then create the rule being verified.
	require.NoError(t, e.db.Where("slot_type = ?", models.SlotTypeGroup).Delete(&models.ReportTariffRule{}).Error)
	price := 600
	duration := 60
	tariff := &models.CommercialTariff{
		ServiceName: "Тестовый групповой тариф", VolumeLabel: "60 мин", DurationMinutes: &duration, PriceRub: &price,
		EffectiveFrom: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), IsActive: true,
	}
	require.NoError(t, e.db.Create(tariff).Error)
	require.NoError(t, e.db.Create(&models.ReportTariffRule{
		SlotType: models.SlotTypeGroup, DurationMinutes: duration, CommercialTariffID: tariff.ID, IsActive: true,
	}).Error)

	group := &models.GroupLesson{
		Name: "Тестовая группа", SubjectID: &subject.ID, DefaultTeacherID: &teacher.ID,
		VisitsPerWeek: 1, DurationMin: duration, MaxStudents: 10, Status: models.GroupLessonStatusActive,
	}
	require.NoError(t, e.db.Create(group).Error)
	require.NoError(t, e.db.Create(&models.GroupLessonEnrollment{GroupLessonID: group.ID, StudentID: firstStudent.ID}).Error)
	require.NoError(t, e.db.Create(&models.GroupLessonEnrollment{GroupLessonID: group.ID, StudentID: secondStudent.ID}).Error)
	weekStart := time.Date(2026, time.July, 6, 0, 0, 0, 0, time.UTC)
	schedule := &models.Schedule{WeekStartDate: weekStart, WeekEndDate: weekStart.AddDate(0, 0, 6), Status: models.ScheduleStatusApproved}
	require.NoError(t, e.db.Create(schedule).Error)
	require.NoError(t, e.db.Create(&models.ScheduleSlot{
		ScheduleID: schedule.ID, SlotType: models.SlotTypeGroup, GroupLessonID: &group.ID, TeacherID: teacher.ID,
		SubjectID: &subject.ID, Weekday: 2, StartTime: "14:00", EndTime: "15:00",
		Origin: models.ScheduleSlotOriginManual, Status: models.ScheduleSlotStatusScheduled,
	}).Error)

	cookies := e.login(t, "admin@test.ru", "Passw0rd")
	w := e.do(http.MethodGet, "/api/admin/reports/monthly?start_date=2026-07-07&end_date=2026-07-07", "", cookies)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var report struct {
		StudentTotals  []monthlyStudentTotalRow `json:"student_totals"`
		Lessons        []reportLessonRow        `json:"lessons"`
		TotalAmountRub int                      `json:"total_amount_rub"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	require.Len(t, report.StudentTotals, 2)
	for _, total := range report.StudentTotals {
		assert.Equal(t, price, total.AmountRub)
	}
	require.Len(t, report.Lessons, 1)
	assert.Equal(t, price, report.Lessons[0].TariffRub)
	assert.Equal(t, price*2, report.Lessons[0].AmountRub)
	assert.Equal(t, price*2, report.TotalAmountRub)
}

func itoa(id uint) string {
	return fmt.Sprintf("%d", id)
}
