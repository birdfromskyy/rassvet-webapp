package models

import "time"

const (
	IssueReasonNoTeacherTime      = "NO_TEACHER_TIME"
	IssueReasonNoStudentTime      = "NO_STUDENT_TIME"
	IssueReasonNoRoom             = "NO_ROOM"
	IssueReasonRoomConflict       = "ROOM_CONFLICT"
	IssueReasonTeacherConflict    = "TEACHER_CONFLICT"
	IssueReasonStudentConflict    = "STUDENT_CONFLICT"
	IssueReasonDistributionFailed = "DISTRIBUTION_FAILED"
)

type ScheduleGenerationIssue struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	ScheduleID   uint      `json:"schedule_id" gorm:"not null;index"`
	AssignmentID uint      `json:"assignment_id" gorm:"not null;index"`
	StudentID    uint      `json:"student_id" gorm:"not null"`
	TeacherID    uint      `json:"teacher_id" gorm:"not null"`
	SubjectID    uint      `json:"subject_id" gorm:"not null"`
	ReasonCode   string    `json:"reason_code" gorm:"type:varchar(50);not null;index"`
	Message      string    `json:"message" gorm:"type:text;not null"`
	CreatedAt    time.Time `json:"created_at"`

	Schedule   Schedule   `json:"schedule,omitempty" gorm:"foreignKey:ScheduleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Assignment Assignment `json:"assignment,omitempty" gorm:"foreignKey:AssignmentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Student    Student    `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher    Teacher    `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Subject    Subject    `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
