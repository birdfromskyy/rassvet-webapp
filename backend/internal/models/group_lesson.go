package models

import "time"

const (
	GroupLessonStatusActive = "active"
	GroupLessonStatusPaused = "paused"
)

type GroupLesson struct {
	ID                   uint       `json:"id" gorm:"primaryKey"`
	Name                 string     `json:"name" gorm:"type:varchar(255);not null"`
	SubjectID            *uint      `json:"subject_id,omitempty" gorm:"index"`
	DefaultTeacherID     *uint      `json:"default_teacher_id,omitempty" gorm:"index"`
	TeacherHoursMode     string     `json:"teacher_hours_mode" gorm:"type:varchar(10);not null;default:'full'"`
	RoomName             string     `json:"room_name,omitempty" gorm:"type:varchar(255)"`
	VisitsPerWeek        int        `json:"visits_per_week" gorm:"not null"`
	DurationMin          int        `json:"duration_min" gorm:"not null"`
	MaxStudents          int        `json:"max_students" gorm:"not null;default:10"`
	Status               string     `json:"status" gorm:"type:varchar(20);not null;default:'active'"`
	ArchivedAt           *time.Time `json:"archived_at,omitempty" gorm:"index"`
	IgnoreStudentWindows bool       `json:"ignore_student_windows" gorm:"not null;default:false"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`

	Subject        *Subject                `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	DefaultTeacher *Teacher                `json:"default_teacher,omitempty" gorm:"foreignKey:DefaultTeacherID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Teachers       []GroupLessonTeacher    `json:"teachers,omitempty" gorm:"foreignKey:GroupLessonID"`
	Enrollments    []GroupLessonEnrollment `json:"enrollments,omitempty" gorm:"foreignKey:GroupLessonID"`
}

const (
	TeacherHoursModeFull  = "full"
	TeacherHoursModeSplit = "split"
)

type GroupLessonTeacher struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	GroupLessonID uint      `json:"group_lesson_id" gorm:"not null;index;uniqueIndex:idx_group_lesson_teacher"`
	TeacherID     uint      `json:"teacher_id" gorm:"not null;index;uniqueIndex:idx_group_lesson_teacher"`
	CreatedAt     time.Time `json:"created_at"`

	GroupLesson GroupLesson `json:"-" gorm:"foreignKey:GroupLessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher     Teacher     `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}
