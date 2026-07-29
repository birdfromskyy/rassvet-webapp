package models

import "time"

// CommercialTariff is one billable commercial service option. One duration has
// its own row so a reporting rule can use PriceRub directly without parsing
// labels. Reports intentionally use the current tariff selected by the rule;
// tariff versioning is not part of the current business policy.
type CommercialTariff struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	ServiceName     string     `json:"service_name" gorm:"type:varchar(255);not null"`
	VolumeLabel     string     `json:"volume_label" gorm:"type:varchar(100);not null"`
	DurationMinutes *int       `json:"duration_minutes" gorm:"index"`
	PriceRub        *int       `json:"price_rub"`
	PriceNote       string     `json:"price_note" gorm:"type:varchar(255)"`
	EffectiveFrom   time.Time  `json:"effective_from" gorm:"type:date;not null;index"`
	EffectiveTo     *time.Time `json:"effective_to" gorm:"type:date;index"`
	SortOrder       int        `json:"sort_order" gorm:"default:0"`
	IsActive        bool       `json:"is_active" gorm:"default:true;index"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
