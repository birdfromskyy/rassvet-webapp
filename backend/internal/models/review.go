package models

import (
	"time"

	"gorm.io/gorm"
)

type ReviewStatus string

const (
	StatusPending  ReviewStatus = "pending"
	StatusApproved ReviewStatus = "approved"
	StatusRejected ReviewStatus = "rejected"
)

type Review struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// For user-submitted reviews: non-nil. For admin-created external reviews: nil.
	UserID      *uint        `gorm:"index" json:"user_id,omitempty"`
	User        User         `json:"user,omitempty"`
	Rating      int          `gorm:"not null" json:"rating"`
	Content     string       `gorm:"type:text;not null" json:"content"`
	IsAnonymous bool         `gorm:"default:false" json:"is_anonymous"`
	Status      ReviewStatus `gorm:"default:pending" json:"status"`

	// Admin-created external reviews only
	AdminAuthorName string `gorm:"size:200" json:"admin_author_name"`
	SourcePlatform  string `gorm:"size:100" json:"source_platform"` // "2ГИС", "Яндекс"

	// Computed for response
	AuthorName string `gorm:"-" json:"author_name,omitempty"`
}

func (r *Review) AfterFind(tx *gorm.DB) error {
	if r.UserID == nil {
		// Admin-created external review
		r.AuthorName = r.AdminAuthorName
	} else if r.IsAnonymous || r.User.ID == 0 {
		r.AuthorName = "Анонимный пользователь"
	} else {
		lastNameRunes := []rune(r.User.LastName)
		if len(lastNameRunes) > 0 {
			r.AuthorName = r.User.FirstName + " " + string(lastNameRunes[0]) + "."
		} else {
			r.AuthorName = r.User.FirstName
		}
	}
	return nil
}
