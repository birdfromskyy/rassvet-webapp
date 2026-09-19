package models

import "time"

// FinZone represents one section on the /fin_activities page (material base).
// Each section has: intro text, two images side-by-side, image caption, and an equipment list.
type FinZone struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Title        string    `json:"title" gorm:"type:varchar(255)"` // public heading; empty = no heading shown
	Text         string    `json:"text" gorm:"type:text"`          // paragraphs shown above images
	ImageURL     string    `json:"image_url" gorm:"type:text"`      // first image
	ImageURL2    string    `json:"image_url_2" gorm:"type:text"`    // second image (optional)
	ImageCaption string    `json:"image_caption" gorm:"type:varchar(500)"` // e.g. "Рисунки 1, 2 – Здание"
	Items        string    `json:"items" gorm:"type:text"`          // JSON []string equipment list
	SortOrder    int       `json:"sort_order" gorm:"default:0"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
