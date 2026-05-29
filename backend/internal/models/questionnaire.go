package models

import (
	"time"

	"gorm.io/gorm"
)

// Questionnaire holds the filled anketa uploaded by a parent.
// The template Word file is stored in site_settings under key "questionnaire_template_url".
type Questionnaire struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID    uint   `gorm:"uniqueIndex;not null" json:"user_id"` // one per user
	FileName  string `gorm:"size:300" json:"file_name"`           // stored in private_uploads/questionnaires
	Status    string `gorm:"size:20;default:'pending'" json:"status"` // pending|approved|rejected
	AdminNote string `gorm:"type:text" json:"admin_note"`
}
