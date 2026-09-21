package handlers

import (
	"backend/internal/models"
	"backend/internal/services"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestStaffDatesAPIPrivacyAndConflicts(t *testing.T) {
	e := newTestEnv(t)
	teacher := models.Teacher{FullName: "Синтетический преподаватель", IsActive: true}
	require.NoError(t, e.db.Create(&teacher).Error)
	path := fmt.Sprintf("/api/admin/staff-dates/teacher/%d", teacher.ID)
	require.Equal(t, 401, e.do("GET", "/api/admin/staff-dates", "", nil).Code)
	user := e.seedUser(t, "staff-view@test.invalid", "password123", "teacher", true)
	require.Equal(t, 403, e.do("GET", "/api/admin/staff-dates", "", e.login(t, user.Email, "password123")).Code)
	admin := e.seedUser(t, "staff-admin@test.invalid", "password123", "admin", true)
	cookies := e.login(t, admin.Email, "password123")
	w := e.do("PUT", path, `{"revision":0,"birth_date":"1980-02-29","medical_until":"2026-10-08"}`, cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	w = e.do("PUT", path, `{"revision":0,"birth_date":null,"medical_until":null}`, cookies)
	require.Equal(t, 409, w.Code)
	w = e.do("PUT", path, `{"revision":1,"birth_date":"2099-01-01","medical_until":null}`, cookies)
	require.Equal(t, 400, w.Code)
	w = e.do("GET", "/api/admin/staff-dates", "", cookies)
	require.Equal(t, 200, w.Code)
	require.Contains(t, w.Body.String(), "1980-02-29")
	require.Contains(t, w.Body.String(), `"birthdays":"11:00"`)
	require.Contains(t, w.Body.String(), `"medical":"11:05"`)
	require.NoError(t, e.db.First(&teacher, teacher.ID).Error)
	public, _ := json.Marshal(teacher)
	require.NotContains(t, string(public), "birth_date")
	require.NotContains(t, string(public), "medical_until")
	ordinary := e.seedUser(t, "not-staff@test.invalid", "password123", "user", true)
	w = e.do("PUT", fmt.Sprintf("/api/admin/staff-dates/user/%d", ordinary.ID), `{"revision":0,"birth_date":null,"medical_until":null}`, cookies)
	require.Equal(t, 400, w.Code)
	linked := models.TeacherUserLink{TeacherID: teacher.ID, UserID: user.ID}
	require.NoError(t, e.db.Create(&linked).Error)
	staff, err := services.ListStaff(e.db, time.Now())
	require.NoError(t, err)
	for _, row := range staff {
		require.False(t, row.Kind == "user" && row.OwnerID == user.ID, "linked person must not appear twice")
	}
}

func TestStaffDatesShowAndCanonicalizeLinkedAccountDate(t *testing.T) {
	e := newTestEnv(t)
	teacher := models.Teacher{FullName: "Преподаватель со старой датой", IsActive: true}
	require.NoError(t, e.db.Create(&teacher).Error)
	account := e.seedUser(t, "staff-old-date@test.invalid", "password123", "teacher", true)
	require.NoError(t, e.db.Create(&models.TeacherUserLink{TeacherID: teacher.ID, UserID: account.ID}).Error)
	birth, medical := models.Date("1984-05-06"), models.Date("2026-12-31")
	legacy := models.StaffDates{UserID: &account.ID, BirthDate: &birth, MedicalUntil: &medical, Revision: 2}
	require.NoError(t, e.db.Create(&legacy).Error)

	admin := e.seedUser(t, "staff-old-date-admin@test.invalid", "password123", "admin", true)
	cookies := e.login(t, admin.Email, "password123")
	w := e.do("GET", "/api/admin/staff-dates", "", cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	require.Contains(t, w.Body.String(), fmt.Sprintf(`"owner_id":%d`, teacher.ID))
	require.Contains(t, w.Body.String(), `"birth_date":"1984-05-06"`)
	require.Contains(t, w.Body.String(), `"medical_until":"2026-12-31"`)

	path := fmt.Sprintf("/api/admin/staff-dates/teacher/%d", teacher.ID)
	w = e.do("PUT", path, `{"revision":2,"birth_date":"1984-05-06","medical_until":"2027-01-15"}`, cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	var saved models.StaffDates
	require.NoError(t, e.db.First(&saved, legacy.ID).Error)
	require.Equal(t, &teacher.ID, saved.TeacherID)
	require.Nil(t, saved.UserID)
	require.Equal(t, models.Date("2027-01-15"), *saved.MedicalUntil)
	require.Equal(t, int64(3), saved.Revision)
}

func TestStaffDatesUseHighestLinkedAccountRole(t *testing.T) {
	e := newTestEnv(t)
	teacher := models.Teacher{FullName: "Сотрудник с несколькими ролями", IsActive: true}
	require.NoError(t, e.db.Create(&teacher).Error)
	admin := e.seedUser(t, "linked-admin@test.invalid", "password123", "admin", true)
	superadmin := e.seedUser(t, "linked-superadmin@test.invalid", "password123", "superadmin", true)
	require.NoError(t, e.db.Create(&models.TeacherUserLink{TeacherID: teacher.ID, UserID: admin.ID}).Error)

	staff, err := services.ListStaff(e.db, time.Now())
	require.NoError(t, err)
	require.Equal(t, "admin", staffRole(t, staff, teacher.ID))

	require.NoError(t, e.db.Create(&models.TeacherUserLink{TeacherID: teacher.ID, UserID: superadmin.ID}).Error)
	staff, err = services.ListStaff(e.db, time.Now())
	require.NoError(t, err)
	require.Equal(t, "superadmin", staffRole(t, staff, teacher.ID))
}

func staffRole(t *testing.T, staff []services.StaffMember, teacherID uint) string {
	t.Helper()
	for _, row := range staff {
		if row.Kind == "teacher" && row.OwnerID == teacherID {
			return row.Role
		}
	}
	t.Fatalf("teacher %d is missing from staff list", teacherID)
	return ""
}

type staffFakeSender struct {
	calls    []int64
	messages []string
	ids      []int64
	fail     bool
}

func (f *staffFakeSender) Configured() bool { return true }
func (f *staffFakeSender) SendStaffReminder(_ context.Context, id int64, message string, key int64) error {
	f.calls = append(f.calls, id)
	f.messages = append(f.messages, message)
	f.ids = append(f.ids, key)
	if f.fail {
		return errors.New("synthetic failure")
	}
	return nil
}

func TestStaffReminderDeliveryRetryOptInAndExpiry(t *testing.T) {
	e := newTestEnv(t)
	teacher := models.Teacher{FullName: "Тестовый сотрудник", IsActive: true}
	require.NoError(t, e.db.Create(&teacher).Error)
	birth, medical := models.Date("1980-09-20"), models.Date("2026-10-08")
	dates := models.StaffDates{TeacherID: &teacher.ID, BirthDate: &birth, MedicalUntil: &medical}
	require.NoError(t, e.db.Create(&dates).Error)
	medicalRecipient := models.VKNotificationRecipient{VKUserID: 101, ProfileURL: "https://vk.com/id101", IsEnabled: true}
	require.NoError(t, e.db.Create(&medicalRecipient).Error)
	birthdayRecipient := models.VKNotificationRecipient{VKUserID: 102, ProfileURL: "https://vk.com/id102", IsEnabled: true}
	require.NoError(t, e.db.Create(&birthdayRecipient).Error)
	disabled := models.VKNotificationRecipient{VKUserID: 103, ProfileURL: "https://vk.com/id103", IsEnabled: false}
	require.NoError(t, e.db.Select("*").Create(&disabled).Error)
	require.NoError(t, e.db.Model(&disabled).Update("is_enabled", false).Error)
	for _, p := range []models.StaffReminderPreference{{RecipientID: medicalRecipient.ID, Medical: true}, {RecipientID: birthdayRecipient.ID, Birthdays: true}, {RecipientID: disabled.ID, Medical: true, Birthdays: true}} {
		require.NoError(t, e.db.Create(&p).Error)
	}
	fake := &staffFakeSender{fail: true}
	worker := services.NewStaffEventService(e.db, fake)
	now := time.Date(2026, 9, 18, 6, 0, 0, 0, time.UTC) // 11:00 UTC+5
	require.NoError(t, worker.Dispatch(context.Background(), now.Add(-time.Minute)))
	require.Empty(t, fake.calls)
	require.NoError(t, worker.Dispatch(context.Background(), now))
	require.Equal(t, []int64{102}, fake.calls, "at 11:00 only birthday reminders are due")
	require.NoError(t, worker.Dispatch(context.Background(), now.Add(time.Minute)))
	require.Len(t, fake.calls, 1)
	require.NoError(t, worker.Dispatch(context.Background(), now.Add(5*time.Minute)))
	require.Equal(t, []int64{102, 101, 102}, fake.calls, "at 11:05 medical starts and the failed birthday is retried")
	fake.fail = false
	require.NoError(t, worker.Dispatch(context.Background(), now.Add(10*time.Minute)))
	require.Equal(t, []int64{102, 101, 102, 101, 102}, fake.calls)
	require.Equal(t, fake.ids[0], fake.ids[2])
	require.Equal(t, fake.ids[0], fake.ids[4])
	require.Equal(t, fake.ids[1], fake.ids[3])
	require.NoError(t, worker.Dispatch(context.Background(), now.AddDate(0, 0, 1)))
	require.Len(t, fake.calls, 5)
	require.NoError(t, worker.Dispatch(context.Background(), now.AddDate(0, 0, 20).Add(5*time.Minute)))
	require.Len(t, fake.calls, 6)
	require.Equal(t, int64(101), fake.calls[5])
	require.Contains(t, fake.messages[5], "Сегодня")
	require.NoError(t, e.db.Model(&medicalRecipient).Update("is_enabled", false).Error)
	newDate := models.Date("2026-10-09")
	require.NoError(t, e.db.Model(&dates).Update("medical_until", newDate).Error)
	require.NoError(t, worker.Dispatch(context.Background(), now.AddDate(0, 0, 21).Add(5*time.Minute)))
	require.Len(t, fake.calls, 6)
}

func TestStaffReminderPreferencesRequireExplicitChoice(t *testing.T) {
	e := newTestEnv(t)
	admin := e.seedUser(t, "staff-settings@test.invalid", "password123", "superadmin", true)
	cookies := e.login(t, admin.Email, "password123")
	r := models.VKNotificationRecipient{VKUserID: 201, ProfileURL: "https://vk.com/id201", IsEnabled: true}
	require.NoError(t, e.db.Create(&r).Error)
	w := e.do("GET", "/api/admin/staff-reminder-recipients", "", cookies)
	require.Equal(t, 200, w.Code)
	require.Contains(t, w.Body.String(), `"medical":false`)
	path := fmt.Sprintf("/api/admin/staff-reminder-recipients/%d", r.ID)
	w = e.do("PUT", path, `{"revision":0,"medical":true,"birthdays":false}`, cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	w = e.do("PUT", path, `{"revision":0,"medical":false,"birthdays":true}`, cookies)
	require.Equal(t, 409, w.Code)
	w = e.do("PUT", path, `{"revision":1,"medical":false,"birthdays":false}`, cookies)
	require.Equal(t, 200, w.Code)
}
