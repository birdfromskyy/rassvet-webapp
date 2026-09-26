package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"log"
	"sort"
	"strings"
	"time"
	_ "time/tzdata"

	"backend/internal/models"

	"gorm.io/gorm"
)

const (
	vkScheduleTimezone = "Asia/Yekaterinburg"
	vkScheduleHour     = 20
	vkMessageLimit     = 3900
)

// VKTeacherScheduleService owns teacher schedule digests and the durable
// change-event outbox. All calendar decisions use the Centre's timezone and
// therefore do not depend on the host or container timezone.
type VKTeacherScheduleService struct {
	db        *gorm.DB
	vk        *VKNotificationService
	location  *time.Location
	wakeQueue chan struct{}
}

// vkScheduleSlotSnapshot contains only the fields needed in a notification
// image. It deliberately stores display names rather than foreign keys so a
// retried event remains truthful after a lesson, child, room, or subject has
// subsequently been edited or deleted.
type vkScheduleSlotSnapshot struct {
	Date       string `json:"date"`
	SlotType   string `json:"slot_type"`
	LessonKind string `json:"lesson_kind"`
	Status     string `json:"status"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time"`
	Audience   string `json:"audience"`
	Subject    string `json:"subject"`
	Room       string `json:"room"`
}

func NewVKTeacherScheduleService(db *gorm.DB, vk *VKNotificationService) (*VKTeacherScheduleService, error) {
	location, err := time.LoadLocation(vkScheduleTimezone)
	if err != nil {
		return nil, fmt.Errorf("load schedule timezone: %w", err)
	}
	return &VKTeacherScheduleService{
		db:        db,
		vk:        vk,
		location:  location,
		wakeQueue: make(chan struct{}, 1),
	}, nil
}

// Run processes queued changes and executes the evening job. A startup after
// 20:00 performs the still-missing delivery for that evening; unique delivery
// rows and deterministic VK random_id values keep retries idempotent.
func (s *VKTeacherScheduleService) Run(ctx context.Context) {
	if s == nil || !s.vk.Configured() {
		return
	}
	s.processPending(ctx)
	now := time.Now().In(s.location)
	if now.Hour() >= vkScheduleHour {
		s.runEveningDeliveries(ctx, now)
	}

	// A failed VK upload is retried within seconds. The durable outbox still
	// protects against a process restart, while the short cadence avoids a
	// recipient waiting minutes for a transient VK/network failure.
	retryTicker := time.NewTicker(5 * time.Second)
	defer retryTicker.Stop()
	timer := time.NewTimer(time.Until(nextScheduleDispatch(time.Now(), s.location)))
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.wakeQueue:
			s.processPending(ctx)
			localNow := time.Now().In(s.location)
			if localNow.Hour() >= vkScheduleHour {
				s.runEveningDeliveries(ctx, localNow)
			}
		case <-retryTicker.C:
			s.processPending(ctx)
			localNow := time.Now().In(s.location)
			if localNow.Hour() >= vkScheduleHour {
				s.runEveningDeliveries(ctx, localNow)
			}
		case dispatchTime := <-timer.C:
			s.runEveningDeliveries(ctx, dispatchTime.In(s.location))
			timer.Reset(time.Until(nextScheduleDispatch(time.Now(), s.location)))
		}
	}
}

// ScheduleApproved wakes the evening catch-up path. If an administrator first
// publishes tomorrow's schedule after 20:00, it is sent immediately instead
// of being silently deferred until the following evening.
func (s *VKTeacherScheduleService) ScheduleApproved() {
	if s == nil || !s.vk.Configured() {
		return
	}
	select {
	case s.wakeQueue <- struct{}{}:
	default:
	}
}

// RecordSlotChange persists one notification per affected subscribed teacher.
// It intentionally ignores draft schedules and lessons that have already
// ended. A same-day lesson is still relevant until its end time.
func (s *VKTeacherScheduleService) RecordSlotChange(action string, before, after *models.ScheduleSlot) error {
	if s == nil || !s.vk.Configured() {
		return nil
	}
	reference := after
	if reference == nil {
		reference = before
	}
	if reference == nil {
		return nil
	}
	if action == "updated" && equivalentScheduleSlots(before, after) {
		return nil
	}
	var schedule models.Schedule
	if err := s.db.First(&schedule, reference.ScheduleID).Error; err != nil {
		return err
	}
	if schedule.Status != models.ScheduleStatusApproved {
		return nil
	}

	now := time.Now().In(s.location)
	oldDate := slotCalendarDate(schedule.WeekStartDate, before, s.location)
	newDate := slotCalendarDate(schedule.WeekStartDate, after, s.location)
	oldTeachers := slotTeacherIDs(before)
	newTeachers := slotTeacherIDs(after)
	allTeachers := unionTeacherIDs(oldTeachers, newTeachers)

	for _, teacherID := range allTeachers {
		dates := make([]time.Time, 0, 2)
		if containsTeacher(oldTeachers, teacherID) && slotHasNotEnded(oldDate, before, now, s.location) {
			dates = appendUniqueDate(dates, oldDate)
		}
		if containsTeacher(newTeachers, teacherID) && slotHasNotEnded(newDate, after, now, s.location) {
			dates = appendUniqueDate(dates, newDate)
		}
		if len(dates) == 0 {
			continue
		}

		var recipient models.VKNotificationRecipient
		if err := s.db.Where(
			"teacher_id = ? AND is_enabled = true AND receive_schedule_notifications = true", teacherID,
		).First(&recipient).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return err
		}

		encodedDates, err := json.Marshal(formatDates(dates))
		if err != nil {
			return err
		}
		beforeSnapshot, err := marshalScheduleSlotSnapshot(before, oldDate)
		if err != nil {
			return err
		}
		afterSnapshot, err := marshalScheduleSlotSnapshot(after, newDate)
		if err != nil {
			return err
		}
		event := models.VKScheduleChangeEvent{
			RecipientID:    recipient.ID,
			TeacherID:      teacherID,
			Action:         action,
			Summary:        s.changeSummary(action, before, after, teacherID, oldDate, newDate),
			AffectedDates:  string(encodedDates),
			BeforeSnapshot: beforeSnapshot,
			AfterSnapshot:  afterSnapshot,
			Status:         models.VKScheduleChangePending,
			NextAttemptAt:  time.Now(),
		}
		if err := s.db.Create(&event).Error; err != nil {
			return err
		}
	}

	select {
	case s.wakeQueue <- struct{}{}:
	default:
	}
	return nil
}

// SendTomorrowTest sends the real approved schedule without recording a
// regular delivery. It is safe for checking a new binding before 20:00.
func (s *VKTeacherScheduleService) SendTomorrowTest(ctx context.Context, recipient models.VKNotificationRecipient) error {
	if !s.vk.Configured() {
		return errors.New("доставка уведомлений в VK временно недоступна")
	}
	if !recipient.IsEnabled || !recipient.ReceiveScheduleNotifications || recipient.TeacherID == nil {
		return errors.New("включите расписание и выберите преподавателя")
	}
	tomorrow := dateOnly(time.Now().In(s.location), s.location).AddDate(0, 0, 1)
	found, err := s.sendTeacherDayImages(ctx, recipient.VKUserID, *recipient.TeacherID, tomorrow, "Расписание на завтра", func(part int) int64 {
		return positiveVKRandomID(secureRandomID() + int64(part))
	})
	if err != nil {
		return err
	}
	if !found {
		return errors.New("на завтра нет занятий в утверждённом расписании")
	}
	return nil
}

func marshalScheduleSlotSnapshot(slot *models.ScheduleSlot, date time.Time) (string, error) {
	if slot == nil {
		return "", nil
	}
	snapshot := vkScheduleSlotSnapshot{
		Date:       date.Format("2006-01-02"),
		SlotType:   slot.SlotType,
		LessonKind: slot.LessonKind,
		Status:     slot.Status,
		StartTime:  slot.StartTime,
		EndTime:    slot.EndTime,
		Audience:   scheduleSlotAudience(*slot),
		Subject:    scheduleSlotSubject(*slot),
		Room:       scheduleSlotRoom(*slot),
	}
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return "", fmt.Errorf("serialize schedule change snapshot: %w", err)
	}
	return string(encoded), nil
}

func parseScheduleSlotSnapshot(value string, location *time.Location) (vkScheduleSlotSnapshot, time.Time, bool, error) {
	if strings.TrimSpace(value) == "" {
		return vkScheduleSlotSnapshot{}, time.Time{}, false, nil
	}
	var snapshot vkScheduleSlotSnapshot
	if err := json.Unmarshal([]byte(value), &snapshot); err != nil {
		return vkScheduleSlotSnapshot{}, time.Time{}, false, fmt.Errorf("parse schedule change snapshot: %w", err)
	}
	if snapshot.Date == "" || snapshot.StartTime == "" || snapshot.EndTime == "" {
		return vkScheduleSlotSnapshot{}, time.Time{}, false, nil
	}
	date, err := time.ParseInLocation("2006-01-02", snapshot.Date, location)
	if err != nil {
		return vkScheduleSlotSnapshot{}, time.Time{}, false, fmt.Errorf("parse schedule change snapshot date: %w", err)
	}
	return snapshot, date, true, nil
}

func (snapshot vkScheduleSlotSnapshot) scheduleSlot() models.ScheduleSlot {
	slot := models.ScheduleSlot{
		SlotType:   snapshot.SlotType,
		LessonKind: snapshot.LessonKind,
		Status:     snapshot.Status,
		StartTime:  snapshot.StartTime,
		EndTime:    snapshot.EndTime,
		Subject:    &models.Subject{Name: snapshot.Subject},
		Room:       &models.Room{Name: snapshot.Room},
	}
	if snapshot.SlotType == models.SlotTypeGroup {
		slot.GroupLesson = &models.GroupLesson{Name: snapshot.Audience}
	} else if snapshot.LessonKind == models.ScheduleLessonKindConsultation {
		slot.GuestChildFirstName = snapshot.Audience
	} else {
		slot.Student = &models.Student{FullName: snapshot.Audience}
	}
	return slot
}

func renderScheduleChangeImage(event *models.VKScheduleChangeEvent, location *time.Location) ([]byte, string, time.Time, bool, error) {
	if event == nil {
		return nil, "", time.Time{}, false, nil
	}
	before, beforeDate, hasBefore, err := parseScheduleSlotSnapshot(event.BeforeSnapshot, location)
	if err != nil {
		return nil, "", time.Time{}, false, err
	}
	after, afterDate, hasAfter, err := parseScheduleSlotSnapshot(event.AfterSnapshot, location)
	if err != nil {
		return nil, "", time.Time{}, false, err
	}

	useBefore := event.Action == "deleted" || strings.HasPrefix(event.Summary, "Удалено")
	if event.Action == "updated" && hasAfter && after.Status == models.ScheduleSlotStatusCancelled {
		useBefore = false
	}
	snapshot, date, ok := after, afterDate, hasAfter
	if useBefore {
		snapshot, date, ok = before, beforeDate, hasBefore
	}
	if !ok {
		return nil, "", time.Time{}, false, nil
	}

	heading := "Изменено занятие"
	switch {
	case event.Action == "created" || strings.HasPrefix(event.Summary, "Добавлено"):
		heading = "Добавлено занятие"
	case event.Action == "deleted" || strings.HasPrefix(event.Summary, "Удалено") || snapshot.Status == models.ScheduleSlotStatusCancelled:
		heading = "Занятие отменено"
	}
	if heading == "Занятие отменено" {
		snapshot.Status = models.ScheduleSlotStatusCancelled
	}
	beforeSlot := before.scheduleSlot()
	afterSlot := after.scheduleSlot()
	eventKind := scheduleEventUpdated
	switch heading {
	case "Добавлено занятие":
		eventKind = scheduleEventCreated
		beforeSlot = afterSlot
	case "Занятие отменено":
		eventKind = scheduleEventCancelled
		beforeSlot = snapshot.scheduleSlot()
	}
	// Created and cancelled events intentionally have a single snapshot.  Give
	// the renderer a date on both sides so their shared header never depends on
	// a zero-value date; updates retain both real dates for the change list.
	if !hasBefore {
		beforeDate = afterDate
	}
	if !hasAfter {
		afterDate = beforeDate
	}
	imageBytes, err := renderScheduleEventImage(eventKind, beforeDate, afterDate, beforeSlot, afterSlot)
	if err != nil {
		return nil, "", time.Time{}, false, err
	}
	return imageBytes, heading, date, true, nil
}

func equivalentScheduleSlots(before, after *models.ScheduleSlot) bool {
	if before == nil || after == nil {
		return false
	}
	if before.Weekday != after.Weekday || before.StartTime != after.StartTime || before.EndTime != after.EndTime ||
		before.SlotType != after.SlotType || before.LessonKind != after.LessonKind || before.RoomName != after.RoomName || before.Status != after.Status ||
		before.GuestChildLastName != after.GuestChildLastName || before.GuestChildFirstName != after.GuestChildFirstName ||
		before.GuestChildMiddleName != after.GuestChildMiddleName ||
		before.TeacherID != after.TeacherID || !sameOptionalUint(before.AssignmentID, after.AssignmentID) ||
		!sameOptionalUint(before.GroupLessonID, after.GroupLessonID) || !sameOptionalUint(before.StudentID, after.StudentID) ||
		!sameOptionalUint(before.SubjectID, after.SubjectID) || !sameOptionalUint(before.RoomID, after.RoomID) {
		return false
	}
	left := slotTeacherIDs(before)
	right := slotTeacherIDs(after)
	if len(left) != len(right) {
		return false
	}
	for _, id := range left {
		if !containsTeacher(right, id) {
			return false
		}
	}
	return true
}

func sameOptionalUint(left, right *uint) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func (s *VKTeacherScheduleService) processPending(ctx context.Context) {
	for {
		var events []models.VKScheduleChangeEvent
		if err := s.db.Where("status = ? AND next_attempt_at <= ?", models.VKScheduleChangePending, time.Now()).
			Order("id ASC").Limit(20).Find(&events).Error; err != nil {
			log.Printf("[VK-SCHEDULE] event=load_outbox_failed error=%q", err.Error())
			return
		}
		if len(events) == 0 {
			return
		}
		for i := range events {
			if ctx.Err() != nil {
				return
			}
			s.processEvent(ctx, &events[i])
		}
	}
}

func (s *VKTeacherScheduleService) processEvent(parent context.Context, event *models.VKScheduleChangeEvent) {
	var recipient models.VKNotificationRecipient
	if err := s.db.First(&recipient, event.RecipientID).Error; err != nil || !recipient.IsEnabled ||
		!recipient.ReceiveScheduleNotifications || recipient.TeacherID == nil || *recipient.TeacherID != event.TeacherID {
		s.markEventSent(event)
		return
	}

	var encodedDates []string
	if err := json.Unmarshal([]byte(event.AffectedDates), &encodedDates); err != nil {
		s.markEventFailed(event, err)
		return
	}
	today := dateOnly(time.Now().In(s.location), s.location)
	relevantDates, err := relevantScheduleDates(encodedDates, today, s.location)
	if err != nil {
		s.markEventFailed(event, err)
		return
	}
	if len(relevantDates) == 0 {
		s.markEventSent(event)
		return
	}
	if image, heading, date, ok, err := renderScheduleChangeImage(event, s.location); err != nil {
		s.markEventFailed(event, err)
		return
	} else if ok {
		ctx, cancel := context.WithTimeout(parent, time.Minute)
		err := s.sendPNGPhotoReliably(ctx, recipient.VKUserID, image, strings.TrimSpace(event.Summary), scheduleEventRandomID(event.ID, recipient.VKUserID, 0))
		cancel()
		if err != nil {
			s.markEventFailed(event, err)
			return
		}
		s.markEventSent(event)
		log.Printf("[VK-SCHEDULE] event=image_change_sent outbox_id=%d teacher_id=%d recipient_id=%d date=%s heading=%q", event.ID, event.TeacherID, event.RecipientID, date.Format("2006-01-02"), heading)
		return
	}
	message := "🔄 Изменение расписания\n\n" + strings.TrimSpace(event.Summary)
	tomorrow := today.AddDate(0, 0, 1)
	for _, date := range relevantDates {
		if !sameDate(date, tomorrow) {
			continue
		}
		var delivered int64
		if err := s.db.Model(&models.VKScheduleDayDelivery{}).
			Where("recipient_id = ? AND date = ? AND kind = ?", recipient.ID, dateOnly(date, time.UTC), "daily").Count(&delivered).Error; err != nil {
			s.markEventFailed(event, err)
			return
		}
		if delivered > 0 {
			scheduleText, found, err := s.formatTeacherDay(event.TeacherID, date, "Актуальное расписание")
			if err != nil {
				s.markEventFailed(event, err)
				return
			}
			if found {
				message += "\n\n" + scheduleText
			}
		}
	}
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	err = s.sendMessageParts(ctx, recipient.VKUserID, message, func(part int) int64 {
		return scheduleEventRandomID(event.ID, recipient.VKUserID, part)
	})
	cancel()
	if err != nil {
		s.markEventFailed(event, err)
		return
	}
	s.markEventSent(event)
	log.Printf("[VK-SCHEDULE] event=change_sent outbox_id=%d teacher_id=%d recipient_id=%d", event.ID, event.TeacherID, event.RecipientID)
}

func relevantScheduleDates(values []string, today time.Time, location *time.Location) ([]time.Time, error) {
	dates := make([]time.Time, 0, len(values))
	for _, value := range values {
		date, err := time.ParseInLocation("2006-01-02", value, location)
		if err != nil {
			return nil, fmt.Errorf("parse affected schedule date %q: %w", value, err)
		}
		if !date.Before(today) {
			dates = append(dates, date)
		}
	}
	return dates, nil
}

func (s *VKTeacherScheduleService) runEveningDeliveries(ctx context.Context, now time.Time) {
	for _, delivery := range scheduleEveningDeliveryPlan(now, s.location) {
		s.deliverDateToAll(ctx, delivery.Date, delivery.Heading, delivery.Kind)
	}
}

type scheduleEveningDelivery struct {
	Date    time.Time
	Heading string
	Kind    string
}

func scheduleEveningDeliveryPlan(now time.Time, location *time.Location) []scheduleEveningDelivery {
	localNow := now.In(location)
	if localNow.Weekday() != time.Saturday {
		return []scheduleEveningDelivery{{
			Date:    dateOnly(localNow, location).AddDate(0, 0, 1),
			Heading: "Расписание на завтра",
			Kind:    "daily",
		}}
	}

	// Saturday evening replaces the regular "tomorrow" digest with the next
	// work week's ordered day cards. Empty days naturally produce no message.
	monday := dateOnly(localNow, location).AddDate(0, 0, 2)
	deliveries := make([]scheduleEveningDelivery, 0, 7)
	for offset := 0; offset < 7; offset++ {
		deliveries = append(deliveries, scheduleEveningDelivery{
			Date:    monday.AddDate(0, 0, offset),
			Heading: "Расписание на неделю",
			Kind:    "weekly",
		})
	}
	return deliveries
}

func (s *VKTeacherScheduleService) deliverDateToAll(parent context.Context, date time.Time, heading, deliveryKind string) {
	if !s.approvedScheduleExists(date) {
		return
	}
	var recipients []models.VKNotificationRecipient
	if err := s.db.Where("is_enabled = true AND receive_schedule_notifications = true AND teacher_id IS NOT NULL").
		Order("id ASC").Find(&recipients).Error; err != nil {
		log.Printf("[VK-SCHEDULE] event=load_recipients_failed error=%q", err.Error())
		return
	}
	for _, recipient := range recipients {
		var alreadySent int64
		storedDate := dateOnly(date, time.UTC)
		if err := s.db.Model(&models.VKScheduleDayDelivery{}).
			Where("recipient_id = ? AND date = ? AND kind = ?", recipient.ID, storedDate, deliveryKind).Count(&alreadySent).Error; err != nil || alreadySent > 0 {
			continue
		}
		ctx, cancel := context.WithTimeout(parent, time.Minute)
		found, err := s.sendTeacherDayImages(ctx, recipient.VKUserID, *recipient.TeacherID, date, heading, func(part int) int64 {
			return scheduleDigestRandomID(recipient.ID, date, deliveryKind, part)
		})
		cancel()
		if err != nil || !found {
			if err != nil {
				log.Printf("[VK-SCHEDULE] event=image_digest_failed teacher_id=%d date=%s error=%q", *recipient.TeacherID, date.Format("2006-01-02"), err.Error())
			}
			continue
		}
		delivery := models.VKScheduleDayDelivery{RecipientID: recipient.ID, TeacherID: *recipient.TeacherID, Date: storedDate, Kind: deliveryKind, SentAt: time.Now()}
		if err := s.db.Create(&delivery).Error; err != nil && !isUniqueConstraintError(err) {
			log.Printf("[VK-SCHEDULE] event=save_delivery_failed teacher_id=%d date=%s error=%q", *recipient.TeacherID, date.Format("2006-01-02"), err.Error())
		}
	}
}

func (s *VKTeacherScheduleService) approvedScheduleExists(date time.Time) bool {
	weekStart := mondayFor(date, s.location)
	var count int64
	return s.db.Model(&models.Schedule{}).
		Where("week_start_date = ? AND status = ?", dateOnly(weekStart, time.UTC), models.ScheduleStatusApproved).
		Count(&count).Error == nil && count > 0
}

func (s *VKTeacherScheduleService) formatTeacherDay(teacherID uint, date time.Time, heading string) (string, bool, error) {
	slots, err := s.teacherDaySlots(teacherID, date)
	if err != nil || len(slots) == 0 {
		return "", len(slots) > 0, err
	}
	lines := []string{fmt.Sprintf("📅 %s — %s", heading, russianFullDate(date))}
	for _, slot := range slots {
		lines = append(lines, formatScheduleSlot(slot))
	}
	return strings.Join(lines, "\n\n"), true, nil
}

func (s *VKTeacherScheduleService) sendTeacherDayImages(ctx context.Context, userID int64, teacherID uint, date time.Time, heading string, randomID func(int) int64) (bool, error) {
	slots, err := s.teacherDaySlots(teacherID, date)
	if err != nil {
		return false, err
	}
	if len(slots) == 0 {
		return false, nil
	}
	pages, err := renderScheduleImagePages(heading, russianFullDate(date), slots)
	if err != nil {
		return false, err
	}
	for index, page := range pages {
		caption := formatScheduleImageCaption(page.Heading, date, page.Slots)
		if err := s.sendPNGPhotoReliably(ctx, userID, page.PNG, caption, randomID(index)); err != nil {
			return false, err
		}
	}
	return true, nil
}

// sendPNGPhotoReliably gives VK transient failures three immediate attempts.
// Every try uses the same VK random_id, so messages.send is idempotent: a
// timeout after VK accepted a message cannot create a duplicate recipient
// notification. A later durable outbox retry is still available if all three
// attempts fail.
func (s *VKTeacherScheduleService) sendPNGPhotoReliably(ctx context.Context, userID int64, imageBytes []byte, message string, randomID int64) error {
	var lastErr error
	for attempt, delay := range []time.Duration{0, time.Second, 3 * time.Second} {
		if delay > 0 {
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
		if err := s.vk.sendPNGPhoto(ctx, userID, imageBytes, message, randomID); err == nil {
			return nil
		} else {
			lastErr = err
			log.Printf("[VK-SCHEDULE] event=photo_attempt_failed attempt=%d recipient_vk_id=%d error=%q", attempt+1, userID, err.Error())
		}
	}
	return lastErr
}

// formatScheduleImageCaption provides a readable, searchable counterpart to
// every image. It intentionally contains only lesson information: no generic
// reminders or invented closing phrases are added to a recipient's message.
func formatScheduleImageCaption(heading string, date time.Time, slots []models.ScheduleSlot) string {
	lines := []string{fmt.Sprintf("📅 %s — %s", heading, russianShortDate(date))}
	for _, slot := range slots {
		marker, kind := scheduleSlotNotificationKind(slot)
		audienceLabel := "Ребёнок"
		if slot.SlotType == models.SlotTypeGroup {
			audienceLabel = "Группа"
		}
		lines = append(lines, strings.Join([]string{
			fmt.Sprintf("%s %s–%s", marker, slot.StartTime, slot.EndTime),
			fmt.Sprintf("%s · %s", kind, valueOrDash(scheduleSlotSubject(slot))),
			audienceLabel + ": " + valueOrDash(scheduleSlotAudience(slot)),
			"Кабинет: " + valueOrDash(scheduleSlotRoom(slot)),
		}, "\n"))
	}
	return strings.Join(lines, "\n\n")
}

func scheduleSlotNotificationKind(slot models.ScheduleSlot) (string, string) {
	if slot.IsConsultation() {
		return "🟠", "Консультация"
	}
	if slot.SlotType == models.SlotTypeGroup {
		return "🟢", "Групповое занятие"
	}
	return "⚪", "Индивидуальное занятие"
}

func (s *VKTeacherScheduleService) teacherDaySlots(teacherID uint, date time.Time) ([]models.ScheduleSlot, error) {
	weekStart := mondayFor(date, s.location)
	var schedule models.Schedule
	if err := s.db.Where("week_start_date = ? AND status = ?", dateOnly(weekStart, time.UTC), models.ScheduleStatusApproved).
		First(&schedule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	var slots []models.ScheduleSlot
	err := s.db.
		Preload("Student").Preload("Subject").Preload("Room").
		Preload("GroupLesson").Preload("GroupLesson.Subject").
		Preload("GroupLessonAttendance.Student").
		Where("schedule_id = ? AND weekday = ? AND status != ? AND (teacher_id = ? OR EXISTS (SELECT 1 FROM schedule_slot_teachers sst WHERE sst.schedule_slot_id = schedule_slots.id AND sst.teacher_id = ?))",
			schedule.ID, weekday, models.ScheduleSlotStatusCancelled, teacherID, teacherID).
		Order("start_time ASC, id ASC").Find(&slots).Error
	if err != nil {
		return nil, err
	}
	return slots, nil
}

func (s *VKTeacherScheduleService) changeSummary(action string, before, after *models.ScheduleSlot, teacherID uint, oldDate, newDate time.Time) string {
	oldHasTeacher := containsTeacher(slotTeacherIDs(before), teacherID)
	newHasTeacher := containsTeacher(slotTeacherIDs(after), teacherID)
	switch {
	case oldHasTeacher && !newHasTeacher:
		return fmt.Sprintf("Удалено ваше занятие %s.\n%s", russianDateWithWeekday(oldDate), formatScheduleSlot(*before))
	case !oldHasTeacher && newHasTeacher:
		return fmt.Sprintf("Добавлено занятие %s.\n%s", russianDateWithWeekday(newDate), formatScheduleSlot(*after))
	case action == "deleted":
		return fmt.Sprintf("Удалено занятие %s.\n%s", russianDateWithWeekday(oldDate), formatScheduleSlot(*before))
	case after != nil && after.Status == models.ScheduleSlotStatusCancelled && (before == nil || before.Status != after.Status):
		return fmt.Sprintf("Отменено занятие %s.\n%s", russianDateWithWeekday(newDate), formatScheduleSlot(*after))
	case before != nil && after != nil && !sameDate(oldDate, newDate):
		return fmt.Sprintf("Занятие перенесено с %s на %s.\n%s", russianDateWithWeekday(oldDate), russianDateWithWeekday(newDate), formatScheduleSlot(*after))
	case action == "created":
		return fmt.Sprintf("Добавлено занятие %s.\n%s", russianDateWithWeekday(newDate), formatScheduleSlot(*after))
	default:
		details := scheduleSlotChanges(before, after)
		if details != "" {
			// Keep the list of changes visually separate from the resulting
			// lesson details in VK, especially when several fields changed.
			return fmt.Sprintf("Изменено занятие %s.%s\n\n%s", russianDateWithWeekday(newDate), details, formatScheduleSlot(*after))
		}
		return fmt.Sprintf("Изменено занятие %s.\n%s", russianDateWithWeekday(newDate), formatScheduleSlot(*after))
	}
}

func scheduleSlotChanges(before, after *models.ScheduleSlot) string {
	if before == nil || after == nil {
		return ""
	}
	changes := make([]string, 0, 6)
	if before.StartTime != after.StartTime || before.EndTime != after.EndTime {
		changes = append(changes, fmt.Sprintf("🕒 Время: %s–%s → %s–%s.", before.StartTime, before.EndTime, after.StartTime, after.EndTime))
	}
	oldSubject, newSubject := scheduleSlotSubject(*before), scheduleSlotSubject(*after)
	if !sameOptionalUint(before.SubjectID, after.SubjectID) || oldSubject != newSubject {
		changes = append(changes, fmt.Sprintf("📚 Предмет: %s → %s.", valueOrDash(oldSubject), valueOrDash(newSubject)))
	}
	oldAudience, newAudience := scheduleSlotAudience(*before), scheduleSlotAudience(*after)
	if before.SlotType != after.SlotType || before.LessonKind != after.LessonKind || !sameOptionalUint(before.StudentID, after.StudentID) ||
		!sameOptionalUint(before.GroupLessonID, after.GroupLessonID) || oldAudience != newAudience {
		changes = append(changes, fmt.Sprintf("🧒 Ребёнок/группа: %s → %s.", valueOrDash(oldAudience), valueOrDash(newAudience)))
	}
	oldRoom, newRoom := scheduleSlotRoom(*before), scheduleSlotRoom(*after)
	if oldRoom != newRoom {
		changes = append(changes, fmt.Sprintf("🚪 Кабинет: %s → %s.", valueOrDash(oldRoom), valueOrDash(newRoom)))
	}
	if before.Status != after.Status {
		changes = append(changes, fmt.Sprintf("📌 Статус: %s.", scheduleStatusLabel(after.Status)))
	}
	if len(changes) == 0 {
		return ""
	}
	return "\n" + strings.Join(changes, "\n")
}

func formatScheduleSlot(slot models.ScheduleSlot) string {
	lines := []string{
		fmt.Sprintf("🕒 %s–%s", slot.StartTime, slot.EndTime),
		"📚 Предмет: " + valueOrDash(scheduleSlotSubject(slot)),
	}
	if slot.SlotType == models.SlotTypeGroup {
		groupName := ""
		if slot.GroupLesson != nil {
			groupName = strings.TrimSpace(slot.GroupLesson.Name)
		}
		lines = append(lines, "👥 Группа: "+valueOrDash(groupName))
		if students := scheduleSlotStudents(slot); students != "" {
			lines = append(lines, "🧒 Дети: "+students)
		}
	} else {
		lines = append(lines, "🧒 Ребёнок: "+valueOrDash(scheduleSlotStudents(slot)))
		if slot.IsConsultation() {
			lines = append(lines, "💬 Консультация")
		}
	}
	lines = append(lines, "🚪 Кабинет: "+valueOrDash(scheduleSlotRoom(slot)))
	return strings.Join(lines, "\n")
}

func scheduleSlotSubject(slot models.ScheduleSlot) string {
	if slot.Subject != nil && strings.TrimSpace(slot.Subject.Name) != "" {
		return strings.TrimSpace(slot.Subject.Name)
	}
	if slot.GroupLesson != nil && slot.GroupLesson.Subject != nil {
		return strings.TrimSpace(slot.GroupLesson.Subject.Name)
	}
	return ""
}

func scheduleSlotStudents(slot models.ScheduleSlot) string {
	if slot.IsConsultation() {
		return slot.GuestChildFullName()
	}
	if slot.Student != nil && strings.TrimSpace(slot.Student.FullName) != "" {
		return strings.TrimSpace(slot.Student.FullName)
	}
	names := make([]string, 0, len(slot.GroupLessonAttendance))
	for _, attendance := range slot.GroupLessonAttendance {
		if name := strings.TrimSpace(attendance.Student.FullName); name != "" {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

func scheduleSlotAudience(slot models.ScheduleSlot) string {
	if slot.SlotType == models.SlotTypeGroup && slot.GroupLesson != nil && strings.TrimSpace(slot.GroupLesson.Name) != "" {
		return strings.TrimSpace(slot.GroupLesson.Name)
	}
	return scheduleSlotStudents(slot)
}

func scheduleSlotRoom(slot models.ScheduleSlot) string {
	room := strings.TrimSpace(slot.RoomName)
	if room == "" && slot.Room != nil {
		room = strings.TrimSpace(slot.Room.Name)
	}
	return room
}

func valueOrDash(value string) string {
	if strings.TrimSpace(value) == "" {
		return "не указан"
	}
	return value
}

func scheduleStatusLabel(status string) string {
	switch status {
	case models.ScheduleSlotStatusScheduled:
		return "запланировано"
	case models.ScheduleSlotStatusMoved:
		return "перенесено"
	case models.ScheduleSlotStatusCancelled:
		return "отменено"
	case models.ScheduleSlotStatusConducted:
		return "проведено"
	default:
		return status
	}
}

func slotTeacherIDs(slot *models.ScheduleSlot) []uint {
	if slot == nil {
		return nil
	}
	ids := make([]uint, 0, len(slot.Teachers)+1)
	for _, link := range slot.Teachers {
		if link.TeacherID != 0 && !containsTeacher(ids, link.TeacherID) {
			ids = append(ids, link.TeacherID)
		}
	}
	if len(ids) == 0 && slot.TeacherID != 0 {
		ids = append(ids, slot.TeacherID)
	}
	return ids
}

func slotCalendarDate(weekStart time.Time, slot *models.ScheduleSlot, location *time.Location) time.Time {
	if slot == nil {
		return time.Time{}
	}
	base := time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, location)
	return base.AddDate(0, 0, slot.Weekday-1)
}

func slotHasNotEnded(date time.Time, slot *models.ScheduleSlot, now time.Time, location *time.Location) bool {
	if slot == nil {
		return false
	}
	end, err := time.Parse("15:04", slot.EndTime)
	if err != nil {
		return date.After(dateOnly(now, location))
	}
	instant := time.Date(date.Year(), date.Month(), date.Day(), end.Hour(), end.Minute(), 0, 0, location)
	return instant.After(now.In(location))
}

func mondayFor(date time.Time, location *time.Location) time.Time {
	local := date.In(location)
	weekday := int(local.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return dateOnly(local, location).AddDate(0, 0, 1-weekday)
}

func nextScheduleDispatch(now time.Time, location *time.Location) time.Time {
	local := now.In(location)
	next := time.Date(local.Year(), local.Month(), local.Day(), vkScheduleHour, 0, 0, 0, location)
	if !local.Before(next) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}

func russianFullDate(date time.Time) string {
	months := [...]string{"января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
	return fmt.Sprintf("%s, %d %s %d", russianWeekday(date), date.Day(), months[date.Month()-1], date.Year())
}

func russianShortDate(date time.Time) string {
	months := [...]string{"января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
	return fmt.Sprintf("%d %s", date.Day(), months[date.Month()-1])
}

func russianDateWithWeekday(date time.Time) string {
	return russianFullDate(date)
}

func russianWeekday(date time.Time) string {
	days := map[time.Weekday]string{time.Monday: "понедельник", time.Tuesday: "вторник", time.Wednesday: "среда", time.Thursday: "четверг", time.Friday: "пятница", time.Saturday: "суббота", time.Sunday: "воскресенье"}
	return days[date.Weekday()]
}

func dateOnly(value time.Time, location *time.Location) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, location)
}

func formatDates(dates []time.Time) []string {
	values := make([]string, len(dates))
	for i, date := range dates {
		values[i] = date.Format("2006-01-02")
	}
	sort.Strings(values)
	return values
}

func appendUniqueDate(dates []time.Time, candidate time.Time) []time.Time {
	for _, date := range dates {
		if sameDate(date, candidate) {
			return dates
		}
	}
	return append(dates, candidate)
}

func sameDate(left, right time.Time) bool {
	return left.Year() == right.Year() && left.Month() == right.Month() && left.Day() == right.Day()
}

func unionTeacherIDs(groups ...[]uint) []uint {
	var result []uint
	for _, group := range groups {
		for _, id := range group {
			if id != 0 && !containsTeacher(result, id) {
				result = append(result, id)
			}
		}
	}
	return result
}

func containsTeacher(ids []uint, candidate uint) bool {
	for _, id := range ids {
		if id == candidate {
			return true
		}
	}
	return false
}

func (s *VKTeacherScheduleService) markEventSent(event *models.VKScheduleChangeEvent) {
	now := time.Now()
	s.db.Model(event).Updates(map[string]any{"status": models.VKScheduleChangeSent, "sent_at": &now, "last_error": ""})
}

func (s *VKTeacherScheduleService) markEventFailed(event *models.VKScheduleChangeEvent, err error) {
	attempts := event.Attempts + 1
	delay := scheduleRetryDelay(attempts)
	s.db.Model(event).Updates(map[string]any{
		"attempts": attempts, "last_error": err.Error(), "next_attempt_at": time.Now().Add(delay),
	})
	log.Printf("[VK-SCHEDULE] event=delivery_failed outbox_id=%d attempt=%d error=%q", event.ID, attempts, err.Error())
}

func scheduleRetryDelay(attempts int) time.Duration {
	switch attempts {
	case 1:
		return 5 * time.Second
	case 2:
		return 15 * time.Second
	case 3:
		return 30 * time.Second
	case 4:
		return time.Minute
	default:
		return time.Duration(1<<min(attempts-4, 5)) * time.Minute
	}
}

func (s *VKTeacherScheduleService) sendMessageParts(ctx context.Context, userID int64, message string, randomID func(int) int64) error {
	for index, part := range splitVKMessage(message) {
		if err := s.vk.sendMessage(ctx, userID, part, randomID(index)); err != nil {
			return err
		}
	}
	return nil
}

func scheduleEventRandomID(eventID uint, vkUserID int64, part int) int64 {
	return hashedVKRandomID(fmt.Sprintf("event:%d:%d:%d", eventID, vkUserID, part))
}

func scheduleDigestRandomID(recipientID uint, date time.Time, kind string, part int) int64 {
	return hashedVKRandomID(fmt.Sprintf("digest:%d:%s:%s:%d", recipientID, date.Format("2006-01-02"), kind, part))
}

func hashedVKRandomID(key string) int64 {
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(key))
	value := int64(hash.Sum32() & 0x7fffffff)
	return positiveVKRandomID(value)
}

func positiveVKRandomID(value int64) int64 {
	value &= 0x7fffffff
	if value <= 0 {
		return 1
	}
	return value
}

func splitVKMessage(message string) []string {
	if len([]rune(message)) <= vkMessageLimit {
		return []string{message}
	}
	paragraphs := strings.Split(message, "\n\n")
	parts := make([]string, 0, 2)
	current := ""
	appendPart := func(value string) {
		if strings.TrimSpace(value) != "" {
			parts = append(parts, value)
		}
	}
	for _, paragraph := range paragraphs {
		candidate := paragraph
		if current != "" {
			candidate = current + "\n\n" + paragraph
		}
		if len([]rune(candidate)) <= vkMessageLimit {
			current = candidate
			continue
		}
		appendPart(current)
		current = ""
		runes := []rune(paragraph)
		for len(runes) > vkMessageLimit {
			appendPart(string(runes[:vkMessageLimit]))
			runes = runes[vkMessageLimit:]
		}
		current = string(runes)
	}
	appendPart(current)
	return parts
}

func isUniqueConstraintError(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}
