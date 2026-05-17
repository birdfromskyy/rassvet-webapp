package models

import "time"

type Employee struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	Name           string    `json:"name" gorm:"type:varchar(255);not null"`
	Category       string    `json:"category" gorm:"type:varchar(100);not null"` // "Руководство" | "Специалисты"
	PhotoURL       string    `json:"photo_url" gorm:"type:text"`
	Qualifications string    `json:"qualifications" gorm:"type:text"` // JSON array of strings
	Education      string    `json:"education" gorm:"type:text"`      // JSON array of strings
	Experience     string    `json:"experience" gorm:"type:varchar(255)"`
	SortOrder      int       `json:"sort_order" gorm:"default:0"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
