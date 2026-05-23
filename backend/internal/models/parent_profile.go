package models

import (
	"time"

	"gorm.io/gorm"
)

// ParentProfile stores a parent user's personal documents and contact phone.
// One record per user (uniqueIndex on UserID).
// PassportFiles and SnilsFiles are JSON arrays of private filenames (UUID.ext),
// stored as text and served only through the authenticated /api/documents/file endpoint.
type ParentProfile struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID        uint       `gorm:"uniqueIndex;not null" json:"user_id"`
	Phone         string     `gorm:"size:20" json:"phone"`
	PassportFiles string     `gorm:"type:text;default:'[]'" json:"passport_files"` // JSON []string of filenames
	SnilsFiles    string     `gorm:"type:text;default:'[]'" json:"snils_files"`    // JSON []string of filenames
	Status        string     `gorm:"size:20;default:'draft'" json:"status"`        // draft | pending | verified
	SubmittedAt   *time.Time `json:"submitted_at"`
}
