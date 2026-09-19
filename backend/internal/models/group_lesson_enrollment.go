package models

import "time"

type GroupLessonEnrollment struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	GroupLessonID uint      `json:"group_lesson_id" gorm:"not null;index;uniqueIndex:idx_group_student_enroll"`
	StudentID     uint      `json:"student_id" gorm:"not null;index;uniqueIndex:idx_group_student_enroll"`
	CreatedAt     time.Time `json:"created_at"`

	GroupLesson GroupLesson `json:"group_lesson,omitempty" gorm:"foreignKey:GroupLessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Student     Student     `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
