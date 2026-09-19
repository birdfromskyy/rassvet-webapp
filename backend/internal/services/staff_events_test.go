package services

import (
	"backend/internal/models"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestStaffBirthdayCalendar(t *testing.T) {
	for _, tc := range []struct{ birth, now, want string }{
		{"1980-01-01", "2026-12-30T18:00:00Z", "2027-01-01"},
		{"1980-02-29", "2027-02-26T18:00:00Z", "2027-02-28"},
		{"1980-02-29", "2028-02-26T18:00:00Z", "2028-02-29"},
		{"1980-09-18", "2026-09-18T20:00:00Z", "2027-09-18"},
	} {
		now, err := time.Parse(time.RFC3339, tc.now)
		require.NoError(t, err)
		got, err := NextStaffBirthday(models.Date(tc.birth), now)
		require.NoError(t, err)
		require.Equal(t, tc.want, got.Format("2006-01-02"))
	}
}
func TestStaffReminderWindowsAndStableKeys(t *testing.T) {
	date := models.Date("2026-10-08")
	for _, tc := range []struct{ days, want int }{{21, 0}, {20, 1}, {19, 1}, {1, 1}, {0, 1}, {-1, 0}} {
		row := StaffMember{Active: true, Name: "Синтетический сотрудник", MedicalDays: &tc.days, Dates: models.StaffDates{MedicalUntil: &date}}
		events := staffDueEvents(row)
		require.Len(t, events, tc.want)
		if tc.want == 1 {
			lead := 20
			if tc.days == 0 {
				lead = 0
			}
			require.Equal(t, lead, events[0].lead)
		}
		row.Active = false
		require.Empty(t, staffDueEvents(row))
	}
	for _, tc := range []struct{ days, want int }{{3, 0}, {2, 1}, {1, 1}, {0, 0}, {-1, 0}} {
		row := StaffMember{Active: true, BirthdayDays: &tc.days, NextBirthday: &date}
		require.Len(t, staffDueEvents(row), tc.want)
	}
	d := models.StaffReminderDelivery{RecipientID: 1, StaffDatesID: 2, Kind: "medical", EventDate: date, LeadDays: 20}
	a := staffRandomID(d)
	require.Positive(t, a)
	require.Equal(t, a, staffRandomID(d))
	d.LeadDays = 0
	require.NotEqual(t, a, staffRandomID(d))
	d.RecipientID = 3
	require.NotEqual(t, a, staffRandomID(d))
}
