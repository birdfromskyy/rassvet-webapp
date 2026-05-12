package models

import "time"

const (
	ScheduleSlotOriginAuto   = "auto"
	ScheduleSlotOriginManual = "manual"

	ScheduleSlotStatusScheduled = "scheduled"
	ScheduleSlotStatusConducted = "conducted"
	ScheduleSlotStatusMoved     = "moved"
	ScheduleSlotStatusCancelled = "cancelled"

	SlotTypeIndividual = "individual"
	SlotTypeGroup      = "group"
)

type ScheduleSlot struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	ScheduleID    uint   `json:"schedule_id" gorm:"not null;index:idx_schedule_weekday"`
	SlotType      string `json:"slot_type" gorm:"type:varchar(20);not null;default:'individual'"`
	AssignmentID  *uint  `json:"assignment_id,omitempty" gorm:"index"`
	GroupLessonID *uint  `json:"group_lesson_id,omitempty" gorm:"index"`
	StudentID     *uint  `json:"student_id,omitempty" gorm:"index:idx_schedule_student_weekday"`
	TeacherID     uint   `json:"teacher_id" gorm:"not null;index:idx_schedule_teacher_weekday"`
	SubjectID     *uint  `json:"subject_id,omitempty" gorm:"index"`
	RoomID        *uint  `json:"room_id,omitempty" gorm:"index:idx_schedule_room_weekday"`
	RoomName      string `json:"room_name,omitempty" gorm:"type:varchar(255)"`
	Weekday       int    `json:"weekday" gorm:"not null;index:idx_schedule_weekday"` // 1=Mon ... 7=Sun
	StartTime     string `json:"start_time" gorm:"type:varchar(5);not null"`         // HH:MM
	EndTime       string `json:"end_time" gorm:"type:varchar(5);not null"`           // HH:MM
	Origin        string `json:"origin" gorm:"type:varchar(20);not null;default:'auto'"`
	Status        string `json:"status" gorm:"type:varchar(20);not null;default:'scheduled'"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Schedule    Schedule               `json:"schedule,omitempty" gorm:"foreignKey:ScheduleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Assignment  *Assignment            `json:"assignment,omitempty" gorm:"foreignKey:AssignmentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	GroupLesson *GroupLesson           `json:"group_lesson,omitempty" gorm:"foreignKey:GroupLessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Student     *Student               `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher     Teacher                `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Subject     *Subject               `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Room        *Room                  `json:"room,omitempty" gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Exclusions  []ScheduleSlotExclusion `json:"exclusions,omitempty" gorm:"foreignKey:ScheduleSlotID"`
}
