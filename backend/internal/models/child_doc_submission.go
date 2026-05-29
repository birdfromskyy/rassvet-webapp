package models

import (
	"time"

	"gorm.io/gorm"
)

// ChildDocSubmission holds one child's document package submitted by a parent.
// Each parent (User) may have up to 5 submissions (enforced in the handler).
// IppsuFiles, BirthCertFiles, ChildSnilsFiles are JSON arrays of private filenames.
type ChildDocSubmission struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID          uint       `gorm:"index;not null" json:"user_id"`
	ChildName       string     `gorm:"size:200;not null" json:"child_name"`
	IppsuFiles      string     `gorm:"type:text;default:'[]'" json:"ippsu_files"`       // JSON []string
	BirthCertFiles  string     `gorm:"type:text;default:'[]'" json:"birth_cert_files"`  // JSON []string
	ChildSnilsFiles string     `gorm:"type:text;default:'[]'" json:"child_snils_files"` // JSON []string
	Status          string     `gorm:"size:20;default:'pending'" json:"status"`         // pending | approved | rejected
	AdminNote       string     `gorm:"type:text" json:"admin_note"`
	IppsuExpiryDate *time.Time `gorm:"index" json:"ippsu_expiry_date"`
	ExpiryNotified  bool       `gorm:"default:false" json:"expiry_notified"`
}
