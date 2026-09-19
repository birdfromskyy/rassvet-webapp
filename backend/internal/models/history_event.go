package models

import "time"

// HistoryEvent represents one year block in the History page timeline.
// Items is a JSON-encoded []string.
type HistoryEvent struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Year      string    `json:"year" gorm:"type:varchar(10);not null"`
	Items     string    `json:"items" gorm:"type:text;not null"` // JSON array of strings
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
