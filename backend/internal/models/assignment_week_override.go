package models

import "time"

type AssignmentWeekOverride struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	AssignmentID  uint      `json:"assignment_id" gorm:"not null;uniqueIndex:idx_assignment_week_override"`
	WeekStartDate time.Time `json:"week_start_date" gorm:"type:date;not null;uniqueIndex:idx_assignment_week_override"`
	PlannedVisits int       `json:"planned_visits" gorm:"not null"`
	DurationMin   *int      `json:"duration_min,omitempty"`
	Status        string    `json:"status" gorm:"type:varchar(20);not null;default:'active'"`
	Notes         *string   `json:"notes,omitempty" gorm:"type:text"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	Assignment Assignment `json:"assignment,omitempty" gorm:"foreignKey:AssignmentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
