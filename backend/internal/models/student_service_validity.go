package models

import "time"

const (
	StudentServiceIppsu                   = "ippsu"
	StudentServiceAdaptivePhysicalCulture = "adaptive_physical_culture"
	StudentServiceMassage                 = "massage"
)

type StudentServiceValidity struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	StudentID       uint       `json:"student_id" gorm:"not null;uniqueIndex:idx_student_service_validity"`
	ServiceType     string     `json:"service_type" gorm:"type:varchar(50);not null;uniqueIndex:idx_student_service_validity"`
	ValidUntil      time.Time  `json:"valid_until" gorm:"type:date;not null;index"`
	NotifiedAt      *time.Time `json:"notified_at,omitempty"`
	UpdatedByUserID uint       `json:"updated_by_user_id" gorm:"not null"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	Student Student `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}
