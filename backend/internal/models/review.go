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

	UserID      uint         `json:"user_id"`
	User        User         `json:"user,omitempty"`
	Rating      int          `gorm:"not null" json:"rating"`
	Content     string       `gorm:"type:text;not null" json:"content"`
	IsAnonymous bool         `gorm:"default:false" json:"is_anonymous"`
	Status      ReviewStatus `gorm:"default:pending" json:"status"`

	// For display
	AuthorName string `gorm:"-" json:"author_name,omitempty"`
}

func (r *Review) AfterFind(tx *gorm.DB) error {
	if !r.IsAnonymous && r.User.ID != 0 {
		if r.User.LastName != "" {
			r.AuthorName = r.User.FirstName + " " + string(r.User.LastName[0]) + "."
		} else {
			r.AuthorName = r.User.FirstName
		}
	} else {
		r.AuthorName = "Анонимный пользователь"
	}
	return nil
}
