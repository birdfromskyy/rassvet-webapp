package models

import "time"

type Subject struct {
	ID                 uint      `json:"id" gorm:"primaryKey"`
	Name               string    `json:"name" gorm:"type:varchar(255);not null;uniqueIndex"`
	DefaultDurationMin int       `json:"default_duration_min" gorm:"not null"`
	IsActive           bool      `json:"is_active" gorm:"not null;default:true"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`

	TeacherSubjects []TeacherSubject `json:"teacher_subjects,omitempty" gorm:"foreignKey:SubjectID"`
	RoomSubjects    []RoomSubject    `json:"room_subjects,omitempty" gorm:"foreignKey:SubjectID"`
	Assignments     []Assignment     `json:"assignments,omitempty" gorm:"foreignKey:SubjectID"`
	ScheduleSlots   []ScheduleSlot   `json:"schedule_slots,omitempty" gorm:"foreignKey:SubjectID"`
}
