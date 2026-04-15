package models

import "time"

type Teacher struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	FullName  string    `json:"full_name" gorm:"type:varchar(255);not null"`
	Phone     *string   `json:"phone,omitempty" gorm:"type:varchar(50)"`
	IsActive  bool      `json:"is_active" gorm:"not null;default:true"`
	Notes     *string   `json:"notes,omitempty" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Subjects         []TeacherSubject          `json:"subjects,omitempty" gorm:"foreignKey:TeacherID"`
	Availability     []TeacherAvailability     `json:"availability,omitempty" gorm:"foreignKey:TeacherID"`
	Assignments      []Assignment              `json:"assignments,omitempty" gorm:"foreignKey:TeacherID"`
	ScheduleSlots    []ScheduleSlot            `json:"schedule_slots,omitempty" gorm:"foreignKey:TeacherID"`
	GenerationIssues []ScheduleGenerationIssue `json:"generation_issues,omitempty" gorm:"foreignKey:TeacherID"`
}
