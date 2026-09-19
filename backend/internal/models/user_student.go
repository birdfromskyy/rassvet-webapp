package models

import "time"

type UserStudent struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_user_student" json:"user_id"`
	StudentID uint      `gorm:"not null;uniqueIndex:idx_user_student" json:"student_id"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Student   *Student  `gorm:"foreignKey:StudentID" json:"student,omitempty"`
}
