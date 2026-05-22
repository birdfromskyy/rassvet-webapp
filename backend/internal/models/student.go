package models

import "time"

const (
	FundingTypePaid   = "paid"
	FundingTypeBudget = "budget"
)

type Student struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	FullName    string    `json:"full_name" gorm:"type:varchar(255);not null"`
	FundingType string    `json:"funding_type" gorm:"type:varchar(20);not null;index"`
	IsActive    bool      `json:"is_active" gorm:"not null;default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Availability     []StudentAvailability     `json:"availability,omitempty" gorm:"foreignKey:StudentID"`
	Assignments      []Assignment              `json:"assignments,omitempty" gorm:"foreignKey:StudentID"`
	ScheduleSlots    []ScheduleSlot            `json:"schedule_slots,omitempty" gorm:"foreignKey:StudentID"`
	GenerationIssues []ScheduleGenerationIssue `json:"generation_issues,omitempty" gorm:"foreignKey:StudentID"`
}
