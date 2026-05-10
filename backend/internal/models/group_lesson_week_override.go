package models

import "time"

type GroupLessonWeekOverride struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	GroupLessonID uint      `json:"group_lesson_id" gorm:"not null;index;uniqueIndex:idx_group_week_override"`
	WeekStartDate time.Time `json:"week_start_date" gorm:"type:date;not null;uniqueIndex:idx_group_week_override"`
	TeacherID     *uint     `json:"teacher_id,omitempty" gorm:"index"`
	PlannedVisits *int      `json:"planned_visits,omitempty"`
	DurationMin   *int      `json:"duration_min,omitempty"`
	Status        string    `json:"status" gorm:"type:varchar(20);not null;default:'active'"`
	Notes         *string   `json:"notes,omitempty" gorm:"type:text"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	GroupLesson GroupLesson `json:"group_lesson,omitempty" gorm:"foreignKey:GroupLessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher     *Teacher    `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}
