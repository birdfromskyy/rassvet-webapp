package models

import "time"

// SocialService is a service from the legal reporting directory. It is kept
// separate from schedule subjects and commercial tariffs: neither scheduling
// nor payroll calculations depend on these records.
type SocialService struct {
	ID                      uint      `json:"id" gorm:"primaryKey"`
	Code                    string    `json:"code" gorm:"type:varchar(32);not null;default:''"`
	Category                string    `json:"category" gorm:"type:varchar(255);not null;index"`
	Name                    string    `json:"name" gorm:"type:text;not null"`
	StandardDurationMinutes int       `json:"standard_duration_minutes" gorm:"not null"`
	Periodicity             string    `json:"periodicity" gorm:"type:varchar(255);not null"`
	TariffKopecks           int64     `json:"tariff_kopecks" gorm:"not null"`
	SortOrder               int       `json:"sort_order" gorm:"not null;default:0"`
	IsActive                bool      `json:"is_active" gorm:"not null;default:true;index"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

// StudentSocialService is the current individual set of services for one
// child. Its editable values are copied from the directory when selected, so a
// later directory edit never silently changes an already configured child.
type StudentSocialService struct {
	ID                      uint      `json:"id" gorm:"primaryKey"`
	StudentID               uint      `json:"student_id" gorm:"not null;uniqueIndex:idx_student_social_service;index"`
	SocialServiceID         uint      `json:"social_service_id" gorm:"not null;uniqueIndex:idx_student_social_service;index"`
	Periodicity             string    `json:"periodicity" gorm:"type:varchar(255);not null"`
	MaximumMonthlyCount     int       `json:"maximum_monthly_count" gorm:"not null"`
	ActualMonthlyCount      int       `json:"actual_monthly_count" gorm:"not null;default:0"`
	StandardDurationMinutes int       `json:"standard_duration_minutes" gorm:"not null"`
	TariffKopecks           int64     `json:"tariff_kopecks" gorm:"not null"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`

	Student       Student       `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SocialService SocialService `json:"social_service,omitempty" gorm:"foreignKey:SocialServiceID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}
