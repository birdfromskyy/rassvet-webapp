package models

import "time"

const (
	AssignmentStatusActive = "active"
	AssignmentStatusPaused = "paused"
)

type Assignment struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	StudentID       uint      `json:"student_id" gorm:"not null;uniqueIndex:idx_student_teacher_subject"`
	TeacherID       uint      `json:"teacher_id" gorm:"not null;index;uniqueIndex:idx_student_teacher_subject"`
	SubjectID       uint      `json:"subject_id" gorm:"not null;index;uniqueIndex:idx_student_teacher_subject"`
	VisitsPerWeek   int       `json:"visits_per_week" gorm:"not null"`
	DurationMin     int       `json:"duration_min" gorm:"not null"`
	Status          string    `json:"status" gorm:"type:varchar(20);not null;default:'active';index"`
	AllowSubstitute bool      `json:"allow_substitute" gorm:"not null;default:false"`
	Notes           *string   `json:"notes,omitempty" gorm:"type:text"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Student       Student                   `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher       Teacher                   `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Subject       Subject                   `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	WeekOverrides []AssignmentWeekOverride  `json:"week_overrides,omitempty" gorm:"foreignKey:AssignmentID"`
	ScheduleSlots []ScheduleSlot            `json:"schedule_slots,omitempty" gorm:"foreignKey:AssignmentID"`
	Issues        []ScheduleGenerationIssue `json:"issues,omitempty" gorm:"foreignKey:AssignmentID"`
}
