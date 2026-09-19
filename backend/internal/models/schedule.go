package models

import "time"

const (
	ScheduleStatusDraft    = "draft"
	ScheduleStatusApproved = "approved"
	ScheduleStatusArchived = "archived"
)

type Schedule struct {
	ID                uint       `json:"id" gorm:"primaryKey"`
	WeekStartDate     time.Time  `json:"week_start_date" gorm:"type:date;not null;uniqueIndex"`
	WeekEndDate       time.Time  `json:"week_end_date" gorm:"type:date;not null"`
	Status            string     `json:"status" gorm:"type:varchar(20);not null;default:'draft';index"`
	GeneratedAt       *time.Time `json:"generated_at,omitempty"`
	GeneratedByUserID *uint      `json:"generated_by_user_id,omitempty"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	ApprovedByUserID  *uint      `json:"approved_by_user_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	Slots  []ScheduleSlot            `json:"slots,omitempty" gorm:"foreignKey:ScheduleID"`
	Issues []ScheduleGenerationIssue `json:"issues,omitempty" gorm:"foreignKey:ScheduleID"`
}
