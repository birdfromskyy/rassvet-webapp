package models

import "time"

type Article struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	Title         string         `json:"title" gorm:"type:varchar(500);not null"`
	Slug          string         `json:"slug" gorm:"type:varchar(500);not null"`
	Summary       string         `json:"summary" gorm:"type:text"`
	FeaturedImage string         `json:"featured_image" gorm:"type:text"`
	Status        string         `json:"status" gorm:"type:varchar(20);default:'draft'"` // draft | published
	PublishedAt   *time.Time     `json:"published_at"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	Blocks        []ArticleBlock `json:"blocks,omitempty" gorm:"foreignKey:ArticleID;constraint:OnDelete:CASCADE"`
}

// ArticleBlock — one content block inside an article.
// Type: text | image | video | file
type ArticleBlock struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ArticleID uint      `json:"article_id" gorm:"not null;index"`
	Type      string    `json:"type" gorm:"type:varchar(20);not null"`
	Content   string    `json:"content" gorm:"type:text"` // text content / upload URL / video URL
	Title     string    `json:"title" gorm:"type:varchar(255)"`
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
}
