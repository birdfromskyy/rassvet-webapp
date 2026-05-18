package models

import "time"

// CmsFile represents uploadable file entries for docs, rules, and rating sections.
// Sorted by sort_order ascending.
type CmsFile struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Section     string    `json:"section" gorm:"type:varchar(50);not null;index"` // docs | rules | rating
	Title       string    `json:"title" gorm:"type:varchar(500);not null"`
	Description string    `json:"description" gorm:"type:text"`
	FileURL     string    `json:"file_url" gorm:"type:text"`
	SortOrder   int       `json:"sort_order" gorm:"default:0"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
