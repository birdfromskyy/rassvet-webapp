package models

import "time"

// ReportTariffRule connects a scheduled lesson to a commercial tariff only for
// reporting. It deliberately does not participate in schedule generation or
// slot validation.
//
// Individual rules are scoped to a subject. Group rules have SubjectID=nil and
// apply to every group lesson of the configured duration.
type ReportTariffRule struct {
	ID                 uint      `json:"id" gorm:"primaryKey"`
	SubjectID          *uint     `json:"subject_id,omitempty" gorm:"index"`
	SlotType           string    `json:"slot_type" gorm:"type:varchar(20);not null;index"`
	DurationMinutes    int       `json:"duration_minutes" gorm:"not null;index"`
	CommercialTariffID uint      `json:"commercial_tariff_id" gorm:"not null;index"`
	IsActive           bool      `json:"is_active" gorm:"not null;default:true;index"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`

	Subject          *Subject         `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	CommercialTariff CommercialTariff `json:"commercial_tariff,omitempty" gorm:"foreignKey:CommercialTariffID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
