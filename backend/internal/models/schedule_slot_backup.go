package models

import "time"

// ScheduleSlotBackup хранит последнюю авто-генерацию до перегенерации.
// Одна запись бэкапа на schedule_id (старые бэкапы удаляются перед сохранением нового).
type ScheduleSlotBackup struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	ScheduleID    uint   `json:"schedule_id" gorm:"not null;index"`
	SlotType      string `json:"slot_type" gorm:"type:varchar(20);not null;default:'individual'"`
	AssignmentID  *uint  `json:"assignment_id,omitempty"`
	GroupLessonID *uint  `json:"group_lesson_id,omitempty"`
	StudentID     *uint  `json:"student_id,omitempty"`
	TeacherID     uint   `json:"teacher_id" gorm:"not null"`
	SubjectID     *uint  `json:"subject_id,omitempty"`
	RoomID        *uint  `json:"room_id,omitempty"`
	RoomName      string `json:"room_name,omitempty" gorm:"type:varchar(255)"`
	Weekday       int    `json:"weekday" gorm:"not null"`
	StartTime     string `json:"start_time" gorm:"type:varchar(5);not null"`
	EndTime       string `json:"end_time" gorm:"type:varchar(5);not null"`
	Origin        string `json:"origin" gorm:"type:varchar(20);not null;default:'auto'"`
	Status        string `json:"status" gorm:"type:varchar(20);not null;default:'scheduled'"`
	BackedUpAt    time.Time `json:"backed_up_at"`
}
