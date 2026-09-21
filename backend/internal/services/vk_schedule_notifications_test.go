package services

import (
	"strings"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/stretchr/testify/require"
)

func TestNextScheduleDispatchUsesYekaterinburgTime(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	if err != nil {
		t.Fatal(err)
	}

	// 14:30 UTC is 19:30 in Yekaterinburg regardless of the server timezone.
	before := time.Date(2026, time.September, 14, 14, 30, 0, 0, time.UTC)
	next := nextScheduleDispatch(before, location)
	if got := next.In(location).Format("2006-01-02 15:04"); got != "2026-09-14 20:00" {
		t.Fatalf("unexpected dispatch before 20:00: %s", got)
	}

	after := time.Date(2026, time.September, 14, 15, 30, 0, 0, time.UTC)
	next = nextScheduleDispatch(after, location)
	if got := next.In(location).Format("2006-01-02 15:04"); got != "2026-09-15 20:00" {
		t.Fatalf("unexpected dispatch after 20:00: %s", got)
	}
}

func TestScheduleSlotChangesNamesChangedFields(t *testing.T) {
	oldRoomID, newRoomID := uint(1), uint(2)
	before := &models.ScheduleSlot{
		StartTime: "10:00", EndTime: "10:40", RoomID: &oldRoomID,
		Room: &models.Room{Name: "Кабинет 1"}, Status: models.ScheduleSlotStatusScheduled,
	}
	after := &models.ScheduleSlot{
		StartTime: "11:00", EndTime: "11:40", RoomID: &newRoomID,
		Room: &models.Room{Name: "Кабинет 2"}, Status: models.ScheduleSlotStatusMoved,
	}

	result := scheduleSlotChanges(before, after)
	for _, expected := range []string{"10:00–10:40 → 11:00–11:40", "Кабинет 1 → Кабинет 2", "Статус: перенесено"} {
		if !strings.Contains(result, expected) {
			t.Errorf("expected %q in %q", expected, result)
		}
	}
}

func TestFormatScheduleSlotUsesReadableEmojiLines(t *testing.T) {
	roomID := uint(1)
	slot := models.ScheduleSlot{
		StartTime: "10:00", EndTime: "10:40", RoomID: &roomID,
		Subject: &models.Subject{Name: "Логопед"},
		Student: &models.Student{FullName: "Иванов Иван"},
		Room:    &models.Room{Name: "Кабинет 1"},
	}

	require.Equal(t, strings.Join([]string{
		"🕒 10:00–10:40",
		"📚 Предмет: Логопед",
		"🧒 Ребёнок: Иванов Иван",
		"🚪 Кабинет: Кабинет 1",
	}, "\n"), formatScheduleSlot(slot))
}

func TestFormatGroupScheduleSlotIncludesGroupAndChildren(t *testing.T) {
	slot := models.ScheduleSlot{
		SlotType:    models.SlotTypeGroup,
		StartTime:   "11:00",
		EndTime:     "12:00",
		Subject:     &models.Subject{Name: "Ритмика"},
		GroupLesson: &models.GroupLesson{Name: "Солнышко"},
		GroupLessonAttendance: []models.GroupLessonAttendance{
			{Student: models.Student{FullName: "Петров Пётр"}},
			{Student: models.Student{FullName: "Иванов Иван"}},
		},
	}

	message := formatScheduleSlot(slot)
	for _, expected := range []string{
		"🕒 11:00–12:00",
		"📚 Предмет: Ритмика",
		"👥 Группа: Солнышко",
		"🧒 Дети: Иванов Иван, Петров Пётр",
		"🚪 Кабинет: не указан",
	} {
		require.Contains(t, message, expected)
	}
}

func TestMondayForSunday(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	if err != nil {
		t.Fatal(err)
	}
	sunday := time.Date(2026, time.September, 20, 12, 0, 0, 0, location)
	if got := mondayFor(sunday, location).Format("2006-01-02"); got != "2026-09-14" {
		t.Fatalf("unexpected Monday: %s", got)
	}
}

func TestSlotHasNotEndedUsesCentreDateAndTime(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	if err != nil {
		t.Fatal(err)
	}
	date := time.Date(2026, time.September, 18, 0, 0, 0, 0, location)
	slot := &models.ScheduleSlot{EndTime: "15:30"}
	if slotHasNotEnded(date, slot, time.Date(2026, time.September, 18, 15, 31, 0, 0, location), location) {
		t.Fatal("an already ended lesson must not produce a VK change")
	}
	if !slotHasNotEnded(date, slot, time.Date(2026, time.September, 18, 15, 29, 0, 0, location), location) {
		t.Fatal("a same-day future lesson must remain eligible")
	}
}

func TestRelevantScheduleDatesDropsPastDays(t *testing.T) {
	location := CentreLocation()
	today := time.Date(2026, time.September, 21, 0, 0, 0, 0, location)
	dates, err := relevantScheduleDates([]string{"2026-09-20", "2026-09-21", "2026-09-22"}, today, location)
	require.NoError(t, err)
	require.Equal(t, []string{"2026-09-21", "2026-09-22"}, formatDates(dates))

	_, err = relevantScheduleDates([]string{"not-a-date"}, today, location)
	require.Error(t, err)
}

func TestSplitVKMessagePreservesAllContent(t *testing.T) {
	paragraph := strings.Repeat("Я", 2100)
	message := paragraph + "\n\n" + paragraph
	parts := splitVKMessage(message)
	if len(parts) != 2 {
		t.Fatalf("expected two parts, got %d", len(parts))
	}
	if strings.Join(parts, "\n\n") != message {
		t.Fatal("split message lost content")
	}
	for _, part := range parts {
		if len([]rune(part)) > vkMessageLimit {
			t.Fatalf("part exceeds VK limit: %d", len([]rune(part)))
		}
	}
}
