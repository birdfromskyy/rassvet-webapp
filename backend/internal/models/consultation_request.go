package models

import (
	"time"

	"gorm.io/gorm"
)

type ConsultationRequest struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID        *uint  `gorm:"index" json:"user_id"`          // nil for guests
	ParentFio     string `gorm:"size:300;not null" json:"parent_fio"`
	Phone         string `gorm:"size:20;not null" json:"phone"`
	ChildFio      string `gorm:"size:300;not null" json:"child_fio"`
	ChildAge      string `gorm:"size:50;not null" json:"child_age"`
	ContactMethod string `gorm:"size:20;default:'phone'" json:"contact_method"` // phone|vk|max|email
	ContactEmail  string `gorm:"size:254" json:"contact_email"`
	RequestText   string `gorm:"type:text" json:"request_text"`
	IPAddress     string `gorm:"size:50" json:"ip_address"`
	Status        string `gorm:"size:20;default:'new'" json:"status"` // new|contacted|closed
	AdminNote     string `gorm:"type:text" json:"admin_note"`
}
