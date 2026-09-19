package models

import "time"

// SiteSetting stores simple key→value pairs for page content that doesn't
// warrant a dedicated table (video URL, single images, text blocks, JSON arrays).
type SiteSetting struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"type:varchar(100);not null"`
	Value     string    `json:"value" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
