package models

import "time"

// VKNotificationRecipient is an explicitly managed VK delivery endpoint. A
// recipient may receive administrator notifications, a linked teacher's
// schedule, or both. The community token is never stored in this table.
type VKNotificationRecipient struct {
	ID                           uint       `gorm:"primarykey" json:"id"`
	CreatedAt                    time.Time  `json:"created_at"`
	UpdatedAt                    time.Time  `json:"updated_at"`
	VKUserID                     int64      `gorm:"uniqueIndex;not null" json:"vk_user_id"`
	ProfileURL                   string     `gorm:"size:500;not null" json:"profile_url"`
	IsEnabled                    bool       `gorm:"default:true;not null" json:"is_enabled"`
	ReceiveAdminNotifications    bool       `gorm:"default:true;not null" json:"receive_admin_notifications"`
	ReceiveScheduleNotifications bool       `gorm:"default:false;not null" json:"receive_schedule_notifications"`
	TeacherID                    *uint      `gorm:"uniqueIndex" json:"teacher_id,omitempty"`
	Teacher                      *Teacher   `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	DisabledAt                   *time.Time `json:"disabled_at"`
}

// VKScheduleDayDelivery records that a concrete VK recipient has already seen
// the full schedule for a date and delivery kind. It prevents duplicate
// evening digests; a daily record also marks tomorrow's schedule as seen.
type VKScheduleDayDelivery struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	RecipientID uint      `gorm:"not null;uniqueIndex:idx_vk_schedule_day_delivery" json:"recipient_id"`
	TeacherID   uint      `gorm:"not null;index" json:"teacher_id"`
	Date        time.Time `gorm:"type:date;not null;uniqueIndex:idx_vk_schedule_day_delivery" json:"date"`
	Kind        string    `gorm:"type:varchar(20);not null;uniqueIndex:idx_vk_schedule_day_delivery" json:"kind"`
	SentAt      time.Time `gorm:"not null" json:"sent_at"`
}

const (
	VKScheduleChangePending = "pending"
	VKScheduleChangeSent    = "sent"
)

// VKScheduleChangeEvent is a durable outbox row. Schedule edits complete even
// if VK is temporarily unavailable; the worker retries delivery afterwards.
type VKScheduleChangeEvent struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	RecipientID   uint      `gorm:"not null;index" json:"recipient_id"`
	TeacherID     uint      `gorm:"not null;index" json:"teacher_id"`
	Action        string    `gorm:"type:varchar(20);not null;default:''" json:"action"`
	Summary       string    `gorm:"type:text;not null" json:"summary"`
	AffectedDates string    `gorm:"type:text;not null" json:"affected_dates"`
	// Snapshots preserve the exact lesson that triggered an event. They let a
	// retry render the same image even after a lesson was deleted or changed.
	BeforeSnapshot string     `gorm:"type:text" json:"-"`
	AfterSnapshot  string     `gorm:"type:text" json:"-"`
	Status         string     `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	Attempts       int        `gorm:"not null;default:0" json:"attempts"`
	NextAttemptAt  time.Time  `gorm:"not null;index" json:"next_attempt_at"`
	SentAt         *time.Time `json:"sent_at,omitempty"`
	LastError      string     `gorm:"type:text" json:"last_error,omitempty"`
}
