package models

import "time"

type GroupLessonAttendance struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	ScheduleSlotID uint      `json:"schedule_slot_id" gorm:"not null;index;uniqueIndex:idx_slot_student_attendance"`
	StudentID      uint      `json:"student_id" gorm:"not null;index;uniqueIndex:idx_slot_student_attendance"`
	Attended       *bool     `json:"attended"` // null=не отмечено, true=был, false=не был
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	ScheduleSlot ScheduleSlot `json:"schedule_slot,omitempty" gorm:"foreignKey:ScheduleSlotID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Student      Student      `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
