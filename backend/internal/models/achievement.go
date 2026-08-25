package models

import (
	"time"

	"gorm.io/gorm"
)

type Achievement struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ChildName      string `gorm:"size:300;not null" json:"child_name"`
	ImageURL       string `gorm:"size:500" json:"image_url"`
	SecondImageURL string `gorm:"size:500" json:"second_image_url"`
	// Description stored as JSON array of paragraph strings
	Description string             `gorm:"type:text" json:"description"`
	Conclusion  string             `gorm:"size:500" json:"conclusion"`
	IsVisible   bool               `gorm:"default:true" json:"is_visible"`
	SortOrder   int                `gorm:"default:0" json:"sort_order"`
	Blocks      []AchievementBlock `json:"blocks,omitempty" gorm:"foreignKey:AchievementID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

// AchievementBlock is one ordered content block in an achievement story.
// Supported types are text, image and video. Achievement blocks deliberately
// have their own table so changes to success stories cannot affect news.
type AchievementBlock struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	AchievementID uint      `gorm:"not null;index" json:"achievement_id"`
	Type          string    `gorm:"type:varchar(20);not null" json:"type"`
	Content       string    `gorm:"type:text" json:"content"`
	Title         string    `gorm:"type:varchar(255)" json:"title"`
	SortOrder     int       `gorm:"default:0" json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
}
