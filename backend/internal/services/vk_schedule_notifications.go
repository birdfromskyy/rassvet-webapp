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

	retryTicker := time.NewTicker(time.Minute)
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
		event := models.VKScheduleChangeEvent{
			RecipientID:   recipient.ID,
			TeacherID:     teacherID,
			Summary:       s.changeSummary(action, before, after, teacherID, oldDate, newDate),
			AffectedDates: string(encodedDates),
			Status:        models.VKScheduleChangePending,
			NextAttemptAt: time.Now(),
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
	message, found, err := s.formatTeacherDay(*recipient.TeacherID, tomorrow, "Тест: расписание на завтра")
	if err != nil {
		return err
	}
	if !found {
		return errors.New("на завтра нет утверждённого расписания")
	}
	baseRandomID := secureRandomID()
	return s.sendMessageParts(ctx, recipient.VKUserID, message, func(part int) int64 {
		return positiveVKRandomID(baseRandomID + int64(part))
	})
}

func equivalentScheduleSlots(before, after *models.ScheduleSlot) bool {
	if before == nil || after == nil {
		return false
	}
	if before.Weekday != after.Weekday || before.StartTime != after.StartTime || before.EndTime != after.EndTime ||
		(before.RoomID == nil) != (after.RoomID == nil) || before.RoomName != after.RoomName || before.Status != after.Status ||
		before.TeacherID != after.TeacherID {
		return false
	}
	if before.RoomID != nil && after.RoomID != nil && *before.RoomID != *after.RoomID {
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
	message := "🔄 Изменение расписания\n\n" + strings.TrimSpace(event.Summary)
	today := dateOnly(time.Now().In(s.location), s.location)
	tomorrow := today.AddDate(0, 0, 1)
	for _, encodedDate := range encodedDates {
		date, err := time.ParseInLocation("2006-01-02", encodedDate, s.location)
		if err != nil || !sameDate(date, tomorrow) {
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
	err := s.sendMessageParts(ctx, recipient.VKUserID, message, func(part int) int64 {
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

func (s *VKTeacherScheduleService) runEveningDeliveries(ctx context.Context, now time.Time) {
	tomorrow := dateOnly(now, s.location).AddDate(0, 0, 1)
	s.deliverDateToAll(ctx, tomorrow, "Расписание на завтра", "daily")
	if now.Weekday() != time.Saturday {
		return
	}
	daysUntilMonday := (int(time.Monday) - int(now.Weekday()) + 7) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	monday := dateOnly(now, s.location).AddDate(0, 0, daysUntilMonday)
	for offset := 0; offset < 7; offset++ {
		s.deliverDateToAll(ctx, monday.AddDate(0, 0, offset), "Расписание на следующую неделю", "weekly")
	}
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
		message, found, err := s.formatTeacherDay(*recipient.TeacherID, date, heading)
		if err != nil || !found {
			if err != nil {
				log.Printf("[VK-SCHEDULE] event=format_digest_failed teacher_id=%d date=%s error=%q", *recipient.TeacherID, date.Format("2006-01-02"), err.Error())
			}
			continue
		}
		ctx, cancel := context.WithTimeout(parent, 12*time.Second)
		err = s.sendMessageParts(ctx, recipient.VKUserID, message, func(part int) int64 {
			return scheduleDigestRandomID(recipient.ID, date, deliveryKind, part)
		})
		cancel()
		if err != nil {
			log.Printf("[VK-SCHEDULE] event=digest_failed teacher_id=%d date=%s error=%q", *recipient.TeacherID, date.Format("2006-01-02"), err.Error())
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
	weekStart := mondayFor(date, s.location)
	var schedule models.Schedule
	if err := s.db.Where("week_start_date = ? AND status = ?", dateOnly(weekStart, time.UTC), models.ScheduleStatusApproved).
		First(&schedule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	var slots []models.ScheduleSlot
	err := s.db.
		Preload("Student").Preload("Subject").Preload("Room").Preload("GroupLesson").
		Where("schedule_id = ? AND weekday = ? AND status != ? AND (teacher_id = ? OR EXISTS (SELECT 1 FROM schedule_slot_teachers sst WHERE sst.schedule_slot_id = schedule_slots.id AND sst.teacher_id = ?))",
			schedule.ID, weekday, models.ScheduleSlotStatusCancelled, teacherID, teacherID).
		Order("start_time ASC, id ASC").Find(&slots).Error
	if err != nil {
		return "", false, err
	}

	lines := []string{fmt.Sprintf("📅 %s — %s", heading, russianFullDate(date))}
	if len(slots) == 0 {
		lines = append(lines, "Занятий нет.")
	} else {
		for _, slot := range slots {
			lines = append(lines, formatScheduleSlot(slot))
		}
	}
	return strings.Join(lines, "\n\n"), true, nil
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
		return fmt.Sprintf("Изменено занятие %s.%s\n%s", russianDateWithWeekday(newDate), details, formatScheduleSlot(*after))
	}
}

func scheduleSlotChanges(before, after *models.ScheduleSlot) string {
	if before == nil || after == nil {
		return ""
	}
	changes := make([]string, 0, 3)
	if before.StartTime != after.StartTime || before.EndTime != after.EndTime {
		changes = append(changes, fmt.Sprintf("Время: %s–%s → %s–%s.", before.StartTime, before.EndTime, after.StartTime, after.EndTime))
	}
	oldRoom, newRoom := scheduleSlotRoom(*before), scheduleSlotRoom(*after)
	if oldRoom != newRoom {
		changes = append(changes, fmt.Sprintf("Кабинет: %s → %s.", valueOrDash(oldRoom), valueOrDash(newRoom)))
	}
	if before.Status != after.Status {
		changes = append(changes, fmt.Sprintf("Статус: %s.", scheduleStatusLabel(after.Status)))
	}
	if len(changes) == 0 {
		return ""
	}
	return "\n" + strings.Join(changes, "\n")
}

func formatScheduleSlot(slot models.ScheduleSlot) string {
	title := "Занятие"
	if slot.SlotType == models.SlotTypeGroup && slot.GroupLesson != nil && strings.TrimSpace(slot.GroupLesson.Name) != "" {
		title = slot.GroupLesson.Name
	} else if slot.Subject != nil && strings.TrimSpace(slot.Subject.Name) != "" {
		title = slot.Subject.Name
	}
	if slot.Student != nil && strings.TrimSpace(slot.Student.FullName) != "" {
		title += " — " + slot.Student.FullName
	}
	room := scheduleSlotRoom(slot)
	line := fmt.Sprintf("%s–%s · %s", slot.StartTime, slot.EndTime, title)
	if room != "" {
		line += "\nКабинет: " + room
	}
	return line
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
	delay := time.Duration(1<<min(attempts, 6)) * time.Minute
	s.db.Model(event).Updates(map[string]any{
		"attempts": attempts, "last_error": err.Error(), "next_attempt_at": time.Now().Add(delay),
	})
	log.Printf("[VK-SCHEDULE] event=delivery_failed outbox_id=%d attempt=%d error=%q", event.ID, attempts, err.Error())
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
