package models

import (
	"time"

	"gorm.io/gorm"
)

type Vacancy struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Title             string `gorm:"size:300;not null" json:"title"`
	Education         string `gorm:"type:text" json:"education"`          // JSON []string
	Experience        string `gorm:"type:text" json:"experience"`         // JSON []string
	Requirements      string `gorm:"type:text" json:"requirements"`       // JSON []string
	Duties            string `gorm:"type:text" json:"duties"`             // JSON []string
	Qualities         string `gorm:"type:text" json:"qualities"`          // JSON []string
	Conditions        string `gorm:"type:text" json:"conditions"`         // JSON []string
	ContactPhone      string `gorm:"size:50" json:"contact_phone"`
	ContactName       string `gorm:"size:200" json:"contact_name"`
	ContactMessengers string `gorm:"size:500" json:"contact_messengers"`
	IsActive          bool   `gorm:"default:true" json:"is_active"`
	SortOrder         int    `gorm:"default:0" json:"sort_order"`
}
