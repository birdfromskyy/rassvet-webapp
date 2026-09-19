package models

import "time"

// CmsFile represents uploadable file entries for docs, rules, and rating sections.
// Sorted by sort_order ascending.
type CmsFile struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Section   string    `json:"section" gorm:"type:varchar(50);not null;index"` // docs | rules | rating
	GroupID   *uint     `json:"group_id,omitempty" gorm:"index"`
	Title     string    `json:"title" gorm:"type:varchar(500);not null"`
	FileURL   string    `json:"file_url" gorm:"type:text"`
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Group *CmsFileGroup `json:"group,omitempty" gorm:"foreignKey:GroupID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
}

// CmsFileGroup is an administrator-managed group of CMS files within one
// public section. It is currently used by the independent quality rating page.
// The name deliberately does not reuse "section": CmsFile.Section identifies
// the site area (docs, rules, rating), while a group is a nested heading such
// as "2025" or "Основные документы".
type CmsFileGroup struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Section   string    `json:"section" gorm:"type:varchar(50);not null;index"`
	Title     string    `json:"title" gorm:"type:varchar(500);not null"`
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Files []CmsFile `json:"files,omitempty" gorm:"foreignKey:GroupID"`
}
