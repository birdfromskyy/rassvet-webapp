package models

import "time"

// ServiceItem represents one service card on the /about_services page.
// Items is a JSON-encoded []string list of bullet points.
type ServiceItem struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Icon      string    `json:"icon" gorm:"type:varchar(20)"`    // emoji
	Title     string    `json:"title" gorm:"type:varchar(255);not null"`
	Text      string    `json:"text" gorm:"type:text"`
	Items     string    `json:"items" gorm:"type:text"` // JSON array of strings
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
