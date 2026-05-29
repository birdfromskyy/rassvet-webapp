package models

import "time"

type VideoShort struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Title     string `gorm:"size:200;not null" json:"title"`
	CoverURL  string `gorm:"size:500" json:"cover_url"`  // /uploads/...
	VideoURL  string `gorm:"size:500" json:"video_url"`  // direct mp4 or VK link
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	IsActive  bool   `gorm:"default:true" json:"is_active"`
}
