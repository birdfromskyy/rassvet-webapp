package models

import (
	"time"

	"gorm.io/gorm"
)

type Achievement struct {
	ID             uint           `gorm:"primarykey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	ChildName      string `gorm:"size:300;not null" json:"child_name"`
	ImageURL       string `gorm:"size:500" json:"image_url"`
	SecondImageURL string `gorm:"size:500" json:"second_image_url"`
	// Description stored as JSON array of paragraph strings
	Description    string `gorm:"type:text" json:"description"`
	Conclusion     string `gorm:"size:500" json:"conclusion"`
	IsVisible      bool   `gorm:"default:true" json:"is_visible"`
	SortOrder      int    `gorm:"default:0" json:"sort_order"`
}
