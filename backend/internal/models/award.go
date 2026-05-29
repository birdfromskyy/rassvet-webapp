package models

import (
	"time"

	"gorm.io/gorm"
)

type Award struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Title     string `gorm:"size:300" json:"title"`
	ImageURL  string `gorm:"size:500;not null" json:"image_url"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	IsVisible bool   `gorm:"default:true" json:"is_visible"`
}
