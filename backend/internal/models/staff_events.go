package models

import "time"

// Private HR dates are deliberately separate from public Teacher/User JSON.
type StaffDates struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	TeacherID    *uint     `json:"teacher_id" gorm:"uniqueIndex;check:staff_dates_owner,(teacher_id IS NOT NULL AND user_id IS NULL) OR (teacher_id IS NULL AND user_id IS NOT NULL)"`
	UserID       *uint     `json:"user_id" gorm:"uniqueIndex"`
	Teacher      *Teacher  `json:"-" gorm:"constraint:OnDelete:CASCADE"`
	User         *User     `json:"-" gorm:"constraint:OnDelete:CASCADE"`
	BirthDate    *Date     `json:"birth_date" gorm:"type:date"`
	MedicalUntil *Date     `json:"medical_until" gorm:"type:date;index"`
	Revision     int64     `json:"revision" gorm:"not null;default:1;check:staff_dates_revision,revision > 0"`
	CreatedAt    time.Time `json:"-"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type StaffReminderPreference struct {
	RecipientID uint                    `json:"recipient_id" gorm:"primaryKey;autoIncrement:false"`
	Recipient   VKNotificationRecipient `json:"-" gorm:"foreignKey:RecipientID;constraint:OnDelete:CASCADE"`
	Medical     bool                    `json:"medical" gorm:"not null;default:false"`
	Birthdays   bool                    `json:"birthdays" gorm:"not null;default:false"`
	Revision    int64                   `json:"revision" gorm:"not null;default:1;check:staff_preference_revision,revision > 0"`
	UpdatedAt   time.Time               `json:"-"`
}

// Durable per-recipient delivery ledger. Dates changing create a new event;
// profile edits alone do not resend the same reminder.
type StaffReminderDelivery struct {
	ID            uint                    `gorm:"primaryKey"`
	RecipientID   uint                    `gorm:"not null;uniqueIndex:staff_reminder_event"`
	Recipient     VKNotificationRecipient `gorm:"foreignKey:RecipientID;constraint:OnDelete:CASCADE"`
	StaffDatesID  uint                    `gorm:"not null;uniqueIndex:staff_reminder_event"`
	StaffDates    StaffDates              `gorm:"foreignKey:StaffDatesID;constraint:OnDelete:CASCADE"`
	Kind          string                  `gorm:"size:16;not null;uniqueIndex:staff_reminder_event"`
	EventDate     Date                    `gorm:"type:date;not null;uniqueIndex:staff_reminder_event"`
	LeadDays      int                     `gorm:"not null;uniqueIndex:staff_reminder_event"`
	SentAt        *time.Time
	Attempts      int `gorm:"not null;default:0"`
	NextAttemptAt time.Time
	CreatedAt     time.Time
}
