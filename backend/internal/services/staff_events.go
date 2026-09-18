package services

import (
	"backend/internal/models"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log"
	"time"
	_ "time/tzdata"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const staffReminderHour = 9

type StaffMember struct {
	Kind         string            `json:"kind"`
	OwnerID      uint              `json:"owner_id"`
	Name         string            `json:"name"`
	Role         string            `json:"role"`
	Active       bool              `json:"active"`
	Dates        models.StaffDates `json:"dates" gorm:"-"`
	MedicalDays  *int              `json:"medical_days" gorm:"-"`
	BirthdayDays *int              `json:"birthday_days" gorm:"-"`
	NextBirthday *models.Date      `json:"next_birthday" gorm:"-"`
}

func StaffLocation() *time.Location { loc, _ := time.LoadLocation("Asia/Yekaterinburg"); return loc }
func staffDay(now time.Time) time.Time {
	local := now.In(StaffLocation())
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, StaffLocation())
}
func calendarDays(a, b time.Time) int { return int(b.Sub(a).Hours() / 24) }

// 29 February is observed on 28 February in non-leap years.
func NextStaffBirthday(d models.Date, now time.Time) (time.Time, error) {
	birth, err := d.Time()
	if err != nil {
		return time.Time{}, err
	}
	today := staffDay(now)
	for year := today.Year(); year <= today.Year()+1; year++ {
		day := birth.Day()
		if birth.Month() == time.February && day == 29 && time.Date(year, 3, 0, 0, 0, 0, 0, today.Location()).Day() == 28 {
			day = 28
		}
		next := time.Date(year, birth.Month(), day, 0, 0, 0, 0, today.Location())
		if !next.Before(today) {
			return next, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid birthday")
}

// Teacher is the canonical identity when an employee account is linked to it.
// Unlinked employee accounts remain visible; no names or dates are guessed.
func ListStaff(db *gorm.DB, now time.Time) ([]StaffMember, error) {
	rows := []StaffMember{}
	err := db.Raw(`SELECT 'teacher' AS kind, t.id AS owner_id, t.full_name AS name, 'teacher' AS role,
		(t.is_active AND t.archived_at IS NULL) AS active FROM teachers t
		UNION ALL SELECT 'user', u.id, concat_ws(' ',u.last_name,u.first_name,nullif(u.middle_name,'')), u.role, true
		FROM users u WHERE u.deleted_at IS NULL AND u.role IN ('teacher','admin','superadmin')
		AND NOT EXISTS (SELECT 1 FROM teacher_user_links l WHERE l.user_id=u.id)
		AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id=u.id)
		ORDER BY name,kind,owner_id`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	var dates []models.StaffDates
	if err = db.Find(&dates).Error; err != nil {
		return nil, err
	}
	byOwner := map[string]models.StaffDates{}
	for _, d := range dates {
		key := ""
		if d.TeacherID != nil {
			key = fmt.Sprintf("teacher/%d", *d.TeacherID)
		} else if d.UserID != nil {
			key = fmt.Sprintf("user/%d", *d.UserID)
		}
		byOwner[key] = d
	}
	today := staffDay(now)
	for i := range rows {
		r := &rows[i]
		r.Dates = byOwner[fmt.Sprintf("%s/%d", r.Kind, r.OwnerID)]
		if d := r.Dates.MedicalUntil; d != nil {
			end, e := time.ParseInLocation("2006-01-02", string(*d), today.Location())
			if e != nil {
				return nil, e
			}
			n := calendarDays(today, end)
			r.MedicalDays = &n
		}
		if d := r.Dates.BirthDate; d != nil {
			end, e := NextStaffBirthday(*d, now)
			if e != nil {
				return nil, e
			}
			n := calendarDays(today, end)
			date := models.Date(end.Format("2006-01-02"))
			r.BirthdayDays = &n
			r.NextBirthday = &date
		}
	}
	return rows, nil
}

type StaffEventService struct {
	db *gorm.DB
	vk StaffReminderSender
}

type StaffReminderSender interface {
	Configured() bool
	SendStaffReminder(context.Context, int64, string, int64) error
}

func (s *VKNotificationService) SendStaffReminder(ctx context.Context, userID int64, message string, randomID int64) error {
	if s.frontendURL != "" {
		message += "\n\n" + s.frontendURL + "/admin/schedule/staff-dates"
	}
	return s.sendMessage(ctx, userID, message, randomID)
}

func NewStaffEventService(db *gorm.DB, vk StaffReminderSender) *StaffEventService {
	return &StaffEventService{db: db, vk: vk}
}
func (s *StaffEventService) Run(ctx context.Context) {
	if !s.vk.Configured() {
		return
	}
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if err := s.Dispatch(ctx, time.Now()); err != nil {
			log.Print("[STAFF-REMINDER] event=dispatch_failed")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

type staffDue struct {
	kind string
	date models.Date
	lead int
	body string
}

func staffDueEvents(row StaffMember) []staffDue {
	var result []staffDue
	if !row.Active {
		return result
	}
	if n := row.MedicalDays; n != nil && *n >= 0 && *n <= 20 {
		lead := 20
		when := fmt.Sprintf("Через %d дн.", *n)
		if *n == 0 {
			lead = 0
			when = "Сегодня"
		}
		result = append(result, staffDue{"medical", *row.Dates.MedicalUntil, lead, fmt.Sprintf("🩺 Медосмотр\n\n%s (%s) истекает срок медосмотра у сотрудника «%s».", when, *row.Dates.MedicalUntil, row.Name)})
	}
	if n := row.BirthdayDays; n != nil && *n >= 1 && *n <= 2 {
		result = append(result, staffDue{"birthday", *row.NextBirthday, 2, fmt.Sprintf("🎂 День рождения\n\nЧерез %d дн. (%s) день рождения у сотрудника «%s».", *n, *row.NextBirthday, row.Name)})
	}
	return result
}
func staffRandomID(d models.StaffReminderDelivery) int64 {
	h := sha256.Sum256([]byte(fmt.Sprintf("staff:%d:%d:%s:%s:%d", d.RecipientID, d.StaffDatesID, d.Kind, d.EventDate, d.LeadDays)))
	return int64(binary.BigEndian.Uint32(h[:4])&0x7ffffffe) + 1
}

// A transactional advisory lock serializes replicas. Pending deliveries survive
// restarts, retry every five minutes, and keep the same VK idempotency key.
func (s *StaffEventService) Dispatch(ctx context.Context, now time.Time) error {
	if !s.vk.Configured() || now.In(StaffLocation()).Hour() < staffReminderHour {
		return nil
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var locked bool
		if err := tx.Raw("SELECT pg_try_advisory_xact_lock(734129845)").Scan(&locked).Error; err != nil {
			return err
		}
		if !locked {
			return nil
		}
		staff, err := ListStaff(tx, now)
		if err != nil {
			return err
		}
		var prefs []models.StaffReminderPreference
		if err = tx.Preload("Recipient").Joins("JOIN vk_notification_recipients r ON r.id=staff_reminder_preferences.recipient_id AND r.is_enabled=true").Where("medical=true OR birthdays=true").Find(&prefs).Error; err != nil {
			return err
		}
		for _, person := range staff {
			for _, due := range staffDueEvents(person) {
				for _, pref := range prefs {
					if (due.kind == "medical" && !pref.Medical) || (due.kind == "birthday" && !pref.Birthdays) {
						continue
					}
					d := models.StaffReminderDelivery{RecipientID: pref.RecipientID, StaffDatesID: person.Dates.ID, Kind: due.kind, EventDate: due.date, LeadDays: due.lead}
					if err = tx.Omit("Recipient", "StaffDates").Clauses(clause.OnConflict{DoNothing: true}).Create(&d).Error; err != nil {
						return err
					}
					if err = tx.Where("recipient_id=? AND staff_dates_id=? AND kind=? AND event_date=? AND lead_days=?", pref.RecipientID, person.Dates.ID, due.kind, due.date, due.lead).First(&d).Error; err != nil {
						return err
					}
					if d.SentAt != nil || d.NextAttemptAt.After(now) {
						continue
					}
					sendCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
					sendErr := s.vk.SendStaffReminder(sendCtx, pref.Recipient.VKUserID, due.body, staffRandomID(d))
					cancel()
					d.Attempts++
					d.NextAttemptAt = now.Add(5 * time.Minute)
					if sendErr == nil {
						d.SentAt = &now
					} else {
						log.Printf("[STAFF-REMINDER] event=delivery_failed recipient_id=%d", pref.RecipientID)
					}
					if err = tx.Omit("Recipient", "StaffDates").Save(&d).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}
