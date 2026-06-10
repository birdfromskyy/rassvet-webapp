package models

import "time"

const (
	GroupLessonStatusActive = "active"
	GroupLessonStatusPaused = "paused"
)

type GroupLesson struct {
	ID               uint      `json:"id" gorm:"primaryKey"`
	Name             string    `json:"name" gorm:"type:varchar(255);not null"`
	SubjectID        *uint     `json:"subject_id,omitempty" gorm:"index"`
	DefaultTeacherID *uint     `json:"default_teacher_id,omitempty" gorm:"index"`
	RoomName         string    `json:"room_name,omitempty" gorm:"type:varchar(255)"`
	VisitsPerWeek    int       `json:"visits_per_week" gorm:"not null"`
	DurationMin      int       `json:"duration_min" gorm:"not null"`
	MaxStudents      int       `json:"max_students" gorm:"not null;default:10"`
	Status               string `json:"status" gorm:"type:varchar(20);not null;default:'active'"`
	IgnoreStudentWindows bool   `json:"ignore_student_windows" gorm:"not null;default:false"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	Subject        *Subject                  `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	DefaultTeacher *Teacher                  `json:"default_teacher,omitempty" gorm:"foreignKey:DefaultTeacherID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Enrollments    []GroupLessonEnrollment   `json:"enrollments,omitempty" gorm:"foreignKey:GroupLessonID"`
}
