package models

import "time"

// ServiceItem represents one service entry managed via the CMS.
// Type "services_list" — hierarchical social services list (/services-list).
// Type "about_services" — description cards (/about_services).
// Items is a JSON-encoded []string list of bullet points.
type ServiceItem struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ParentID  *uint     `json:"parent_id" gorm:"index"`
	Type      string    `json:"type" gorm:"type:varchar(50);not null;default:'services_list'"`
	Title     string    `json:"title" gorm:"type:varchar(255);not null"`
	Text      string    `json:"text" gorm:"type:text"`
	Items     string    `json:"items" gorm:"type:text"` // JSON array of strings
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
