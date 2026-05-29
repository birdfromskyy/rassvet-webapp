package models

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID uint   `gorm:"index;not null" json:"user_id"`
	Title  string `gorm:"size:255;not null" json:"title"`
	Body   string `gorm:"type:text" json:"body"`
	IsRead bool   `gorm:"default:false" json:"is_read"`
	Link   string `gorm:"size:500" json:"link"` // optional: e.g. "/admin/documents"
}
