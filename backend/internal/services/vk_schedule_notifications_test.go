package services

import (
	"strings"
	"testing"
	"time"

	"backend/internal/models"
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
