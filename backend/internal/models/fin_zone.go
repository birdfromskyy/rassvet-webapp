package models

import "time"

// FinZone represents one zone card on the /fin_activities page (material base section).
// Items is a JSON-encoded []string list of equipment/features.
type FinZone struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Title     string    `json:"title" gorm:"type:varchar(255);not null"`
	Accent    string    `json:"accent" gorm:"type:varchar(255)"` // small label above title
	Text      string    `json:"text" gorm:"type:text"`           // optional paragraph
	ImageURL  string    `json:"image_url" gorm:"type:text"`
	Items     string    `json:"items" gorm:"type:text"` // JSON array of strings
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
