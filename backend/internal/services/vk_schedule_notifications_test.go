package services

import (
	"bytes"
	"image/png"
	"strings"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/stretchr/testify/require"
)

func TestRenderScheduleImagesProducesPNGWithCardPages(t *testing.T) {
	slots := make([]models.ScheduleSlot, scheduleImageMaxCards+1)
	for index := range slots {
		slots[index] = models.ScheduleSlot{
			SlotType:  models.SlotTypeIndividual,
			StartTime: "10:00",
			EndTime:   "10:40",
			Student:   &models.Student{FullName: "Иванов Иван"},
			Subject:   &models.Subject{Name: "Логопед"},
			Room:      &models.Room{Name: "Кабинет 1"},
		}
	}
	images, err := renderScheduleImages("Расписание на завтра", "суббота, 27 сентября 2026", slots)
	require.NoError(t, err)
	require.Len(t, images, 2)
	decoded, err := png.Decode(bytes.NewReader(images[0]))
	require.NoError(t, err)
	require.Equal(t, scheduleImageWidth, decoded.Bounds().Dx())
	require.Greater(t, decoded.Bounds().Dy(), 500)
}

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

func TestScheduleEveningDeliveryPlanSendsNextWeekOnSaturdayInDayOrder(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	require.NoError(t, err)

	// Saturday, 26 September 2026: the first card must be next Monday, not
	// Sunday's normal daily reminder.
	plan := scheduleEveningDeliveryPlan(time.Date(2026, time.September, 26, 20, 0, 0, 0, location), location)
	require.Len(t, plan, 7)
	for index, delivery := range plan {
		require.Equal(t, "weekly", delivery.Kind)
		require.Equal(t, "Расписание на неделю", delivery.Heading)
		require.Equal(t, time.Date(2026, time.September, 28+index, 0, 0, 0, 0, location).Format("2006-01-02"), delivery.Date.Format("2006-01-02"))
	}
}

func TestFormatScheduleImageCaptionSeparatesLessonFields(t *testing.T) {
	slots := []models.ScheduleSlot{
		{
			SlotType:  models.SlotTypeIndividual,
			StartTime: "09:00", EndTime: "09:50",
			Student: &models.Student{FullName: "Иванов Арсений"},
			Subject: &models.Subject{Name: "Логопед"},
			Room:    &models.Room{Name: "3"},
		},
		{
			SlotType:            models.SlotTypeIndividual,
			LessonKind:          models.ScheduleLessonKindConsultation,
			GuestChildLastName:  "Петрова",
			GuestChildFirstName: "Анна",
			StartTime:           "10:00", EndTime: "10:50",
			Subject: &models.Subject{Name: "Психолог"},
			Room:    &models.Room{Name: "2"},
		},
		{
			SlotType:  models.SlotTypeGroup,
			StartTime: "11:00", EndTime: "11:50",
			GroupLesson: &models.GroupLesson{Name: "Солнышко"},
			Subject:     &models.Subject{Name: "Адаптация"},
			Room:        &models.Room{Name: "5"},
		},
	}

	caption := formatScheduleImageCaption("Расписание на завтра", time.Date(2026, time.September, 27, 0, 0, 0, 0, time.UTC), slots)
	for _, expected := range []string{
		"📅 Расписание на завтра — 27 сентября",
		"⚪ 09:00–09:50\nИндивидуальное занятие · Логопед\nРебёнок: Иванов Арсений\nКабинет: 3",
		"🟠 10:00–10:50\nКонсультация · Психолог\nРебёнок: Петрова Анна\nКабинет: 2",
		"🟢 11:00–11:50\nГрупповое занятие · Адаптация\nГруппа: Солнышко\nКабинет: 5",
	} {
		require.Contains(t, caption, expected)
	}
}

func TestConsultationCardSubjectIncludesTypeWithoutTag(t *testing.T) {
	slot := models.ScheduleSlot{
		LessonKind: models.ScheduleLessonKindConsultation,
		Subject:    &models.Subject{Name: "Логопед"},
	}
	require.Equal(t, "Консультация • Логопед", scheduleSlotCardSubject(slot))
}

func TestScheduleSlotDurationLabel(t *testing.T) {
	require.Equal(t, "50 минут", scheduleSlotDurationLabel(models.ScheduleSlot{StartTime: "09:00", EndTime: "09:50"}))
	require.Equal(t, "1 минута", scheduleSlotDurationLabel(models.ScheduleSlot{StartTime: "09:00", EndTime: "09:01"}))
	require.Equal(t, "", scheduleSlotDurationLabel(models.ScheduleSlot{StartTime: "09:50", EndTime: "09:00"}))
}

func TestLongScheduleCardTextWrapsAndExpandsWithoutEllipsis(t *testing.T) {
	require.NoError(t, loadScheduleImageFonts())
	room := "Этнографический музей Торамаа выставочный зал народных традиций и ремёсел"
	slot := models.ScheduleSlot{
		SlotType:  models.SlotTypeGroup,
		StartTime: "14:00",
		EndTime:   "15:50",
		GroupLesson: &models.GroupLesson{
			Name: "Верёвочный парк и познавательная прогулка по территории музея",
		},
		Subject: &models.Subject{Name: "Ознакомительное занятие"},
		Room:    &models.Room{Name: room},
	}
	layout := scheduleSlotCardTextLayout(slot, scheduleImageWidth-82-(82+310)-34)
	require.Greater(t, layout.Height, 172)
	require.Equal(t, "Кабинет: "+room, strings.Join(layout.RoomLines, " "))
	require.NotContains(t, strings.Join(append(append(layout.AudienceLines, layout.SubjectLines...), layout.RoomLines...), " "), "…")

	images, err := renderScheduleImages("Расписание на завтра", "воскресенье, 27 сентября 2026", []models.ScheduleSlot{slot})
	require.NoError(t, err)
	decoded, err := png.Decode(bytes.NewReader(images[0]))
	require.NoError(t, err)
	// A one-card image with the original fixed card would be 560 px high.
	require.Greater(t, decoded.Bounds().Dy(), 560)
}

func TestScheduleRetryDelayStartsWithinSeconds(t *testing.T) {
	require.Equal(t, 5*time.Second, scheduleRetryDelay(1))
	require.Equal(t, 15*time.Second, scheduleRetryDelay(2))
	require.Equal(t, 30*time.Second, scheduleRetryDelay(3))
	require.Equal(t, time.Minute, scheduleRetryDelay(4))
}

func TestRenderScheduleChangeImageUsesDurableSnapshot(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	require.NoError(t, err)
	slot := &models.ScheduleSlot{
		SlotType:            models.SlotTypeIndividual,
		LessonKind:          models.ScheduleLessonKindConsultation,
		Status:              models.ScheduleSlotStatusScheduled,
		StartTime:           "09:00",
		EndTime:             "09:50",
		GuestChildLastName:  "Иванов",
		GuestChildFirstName: "Иван",
		Subject:             &models.Subject{Name: "Логопед"},
		Room:                &models.Room{Name: "Кабинет 3"},
	}
	snapshot, err := marshalScheduleSlotSnapshot(slot, time.Date(2026, time.September, 27, 0, 0, 0, 0, location))
	require.NoError(t, err)

	imageBytes, heading, date, found, err := renderScheduleChangeImage(&models.VKScheduleChangeEvent{
		Action:        "created",
		Summary:       "Добавлено занятие.",
		AfterSnapshot: snapshot,
	}, location)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "Добавлено занятие", heading)
	require.Equal(t, "2026-09-27", date.Format("2006-01-02"))
	decoded, err := png.Decode(bytes.NewReader(imageBytes))
	require.NoError(t, err)
	require.Equal(t, scheduleImageWidth, decoded.Bounds().Dx())
}

func TestRenderScheduleEventImagesHaveDedicatedLayouts(t *testing.T) {
	date := time.Date(2026, time.September, 27, 0, 0, 0, 0, CentreLocation())
	before := models.ScheduleSlot{SlotType: models.SlotTypeIndividual, StartTime: "09:00", EndTime: "09:50", Student: &models.Student{FullName: "Иванов Иван"}}
	after := before
	after.StartTime, after.EndTime = "09:20", "10:10"

	created, err := renderScheduleEventImage(scheduleEventCreated, date, date, before, after)
	require.NoError(t, err)
	changed, err := renderScheduleEventImage(scheduleEventUpdated, date, date, before, after)
	require.NoError(t, err)
	cancelled, err := renderScheduleEventImage(scheduleEventCancelled, date, date, before, after)
	require.NoError(t, err)
	for _, imageBytes := range [][]byte{created, changed, cancelled} {
		decoded, decodeErr := png.Decode(bytes.NewReader(imageBytes))
		require.NoError(t, decodeErr)
		require.Equal(t, scheduleImageWidth, decoded.Bounds().Dx())
	}
	createdImage, err := png.Decode(bytes.NewReader(created))
	require.NoError(t, err)
	changedImage, err := png.Decode(bytes.NewReader(changed))
	require.NoError(t, err)
	require.Greater(t, changedImage.Bounds().Dy(), createdImage.Bounds().Dy())
}

func TestScheduleEventImageChangesListsEveryChangedField(t *testing.T) {
	date := time.Date(2026, time.September, 27, 0, 0, 0, 0, CentreLocation())
	before := models.ScheduleSlot{
		SlotType:  models.SlotTypeIndividual,
		StartTime: "12:00",
		EndTime:   "12:50",
		Student:   &models.Student{FullName: "Стокач Леонид"},
		Subject:   &models.Subject{Name: "Психолог"},
		Room:      &models.Room{Name: "Психолог"},
	}
	after := before
	after.StartTime, after.EndTime = "12:10", "13:00"
	after.Subject = &models.Subject{Name: "Логопед"}
	after.Room = &models.Room{Name: "Логопед"}

	changes := scheduleEventImageChanges(date, date, before, after)
	require.Equal(t, []scheduleEventImageChange{
		{Label: "Время", Before: "12:00–12:50", After: "12:10–13:00"},
		{Label: "Предмет", Before: "Психолог", After: "Логопед"},
		{Label: "Кабинет", Before: "Психолог", After: "Логопед"},
	}, changes)
}

func TestRenderScheduleChangeImageUsesBeforeSnapshotForDeletion(t *testing.T) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	require.NoError(t, err)
	snapshot, err := marshalScheduleSlotSnapshot(&models.ScheduleSlot{
		SlotType:  models.SlotTypeIndividual,
		StartTime: "09:00", EndTime: "09:50",
		Student: &models.Student{FullName: "Иванов Иван"},
		Subject: &models.Subject{Name: "Логопед"},
		Room:    &models.Room{Name: "Кабинет 3"},
	}, time.Date(2026, time.September, 27, 0, 0, 0, 0, location))
	require.NoError(t, err)

	_, heading, _, found, err := renderScheduleChangeImage(&models.VKScheduleChangeEvent{
		Action:         "deleted",
		Summary:        "Удалено занятие.",
		BeforeSnapshot: snapshot,
	}, location)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "Занятие отменено", heading)
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

func TestChangeSummarySeparatesChangesFromResultingLesson(t *testing.T) {
	before := &models.ScheduleSlot{
		SlotType:  models.SlotTypeIndividual,
		StartTime: "12:00", EndTime: "12:50",
		Student: &models.Student{FullName: "Иванов Арсений"},
		Room:    &models.Room{Name: "Психолог"},
	}
	after := *before
	after.Room = &models.Room{Name: "Логопед"}
	date := time.Date(2026, time.September, 27, 0, 0, 0, 0, CentreLocation())

	message := (&VKTeacherScheduleService{}).changeSummary("updated", before, &after, 1, date, date)
	require.Contains(t, message, "🚪 Кабинет: Психолог → Логопед.\n\n🕒 12:00–12:50")
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

func TestFormatConsultationScheduleSlotUsesGuestChildName(t *testing.T) {
	slot := models.ScheduleSlot{
		SlotType:            models.SlotTypeIndividual,
		LessonKind:          models.ScheduleLessonKindConsultation,
		GuestChildLastName:  "Иванов",
		GuestChildFirstName: "Иван",
		StartTime:           "10:40",
		EndTime:             "11:10",
		Subject:             &models.Subject{Name: "Психолог"},
		Room:                &models.Room{Name: "Кабинет психолога"},
	}

	message := formatScheduleSlot(slot)
	for _, expected := range []string{
		"🕒 10:40–11:10",
		"💬 Консультация",
		"📚 Предмет: Психолог",
		"🧒 Ребёнок: Иванов Иван",
		"🚪 Кабинет: Кабинет психолога",
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
