package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// Date is a calendar date, never a timezone-dependent instant.
type Date string

func (d Date) Time() (time.Time, error) {
	t, err := time.Parse("2006-01-02", string(d))
	if err == nil && t.Year() < 1 {
		return time.Time{}, fmt.Errorf("calendar year must be positive")
	}
	return t, err
}
func (d Date) Value() (driver.Value, error) {
	if _, err := d.Time(); err != nil {
		return nil, err
	}
	return string(d), nil
}
func (d *Date) Scan(v interface{}) error {
	switch v := v.(type) {
	case time.Time:
		*d = Date(v.Format("2006-01-02"))
	case string:
		*d = Date(v)
	case []byte:
		*d = Date(v)
	default:
		return fmt.Errorf("invalid calendar date type %T", v)
	}
	_, err := d.Time()
	return err
}
func (d *Date) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	v := Date(s)
	if _, err := v.Time(); err != nil {
		return err
	}
	*d = v
	return nil
}

type LegalRepresentative struct {
	ID         uint      `json:"id"`
	UserID     *uint     `json:"user_id"`
	LastName   string    `json:"last_name"`
	FirstName  string    `json:"first_name"`
	MiddleName string    `json:"middle_name"`
	BirthDate  *Date     `json:"birth_date" gorm:"type:date"`
	IsActive   bool      `json:"is_active"`
	Revision   int64     `json:"revision"`
	CreatedBy  *uint     `json:"created_by"`
	UpdatedBy  *uint     `json:"updated_by"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type StudentLegalRepresentative struct {
	ID                    uint      `json:"id"`
	StudentID             uint      `json:"student_id"`
	LegalRepresentativeID uint      `json:"legal_representative_id"`
	Relationship          string    `json:"relationship"`
	ValidFrom             *Date     `json:"valid_from" gorm:"type:date"`
	ValidUntil            *Date     `json:"valid_until" gorm:"type:date"`
	Revision              int64     `json:"revision"`
	CreatedBy             *uint     `json:"created_by"`
	UpdatedBy             *uint     `json:"updated_by"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type SocialServiceReportSettings struct {
	ID             uint      `json:"id"`
	ContractNumber string    `json:"contract_number"`
	ContractDate   *Date     `json:"contract_date" gorm:"type:date"`
	Revision       int64     `json:"revision"`
	UpdatedBy      *uint     `json:"updated_by"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ReportingPerson struct {
	ID         uint   `json:"id"`
	FullName   string `json:"full_name"`
	LastName   string `json:"last_name"`
	FirstName  string `json:"first_name"`
	MiddleName string `json:"middle_name"`
	BirthDate  *Date  `json:"birth_date"`
	Revision   int64  `json:"revision"`
}

type ServiceMonthSnapshot struct {
	SchemaVersion          int                         `json:"schema_version"`
	Student                ReportingPerson             `json:"student"`
	Representative         *ReportingPerson            `json:"representative"`
	Relationship           string                      `json:"relationship"`
	RelationshipRevision   int64                       `json:"relationship_revision"`
	RelationshipValidFrom  *Date                       `json:"relationship_valid_from"`
	RelationshipValidUntil *Date                       `json:"relationship_valid_until"`
	Contract               SocialServiceReportSettings `json:"contract"`
}

type StudentServiceMonth struct {
	ID               uint                      `json:"id"`
	StudentID        uint                      `json:"student_id"`
	Month            Date                      `json:"month" gorm:"type:date"`
	RepresentativeID *uint                     `json:"representative_id"`
	Status           string                    `json:"status"`
	Revision         int64                     `json:"revision"`
	Snapshot         ServiceMonthSnapshot      `json:"snapshot" gorm:"serializer:json;type:jsonb"`
	CreationKey      string                    `json:"-"`
	CreationHash     string                    `json:"-"`
	CreatedBy        *uint                     `json:"created_by"`
	UpdatedBy        *uint                     `json:"updated_by"`
	CreatedAt        time.Time                 `json:"created_at"`
	UpdatedAt        time.Time                 `json:"updated_at"`
	Items            []StudentServiceMonthItem `json:"items" gorm:"foreignKey:MonthID"`
}

type StudentServiceMonthItem struct {
	ID                      uint   `json:"id"`
	MonthID                 uint   `json:"month_id"`
	SocialServiceID         uint   `json:"social_service_id"`
	Code                    string `json:"code"`
	Name                    string `json:"name"`
	Category                string `json:"category"`
	SortOrder               int    `json:"sort_order"`
	Periodicity             string `json:"periodicity"`
	FrequencyCount          *int   `json:"frequency_count"`
	FrequencyUnit           string `json:"frequency_unit"`
	MaximumMonthlyCount     int    `json:"maximum_monthly_count"`
	ActualMonthlyCount      *int   `json:"actual_monthly_count"`
	StandardDurationMinutes int    `json:"standard_duration_minutes"`
	TariffKopecks           int64  `json:"tariff_kopecks"`
}

type StudentServiceMonthRevision struct {
	ID        uint                `json:"id"`
	MonthID   uint                `json:"month_id"`
	Revision  int64               `json:"revision"`
	Action    string              `json:"action"`
	Data      StudentServiceMonth `json:"data" gorm:"serializer:json;type:jsonb"`
	CreatedBy *uint               `json:"created_by"`
	CreatedAt time.Time           `json:"created_at"`
}

type SocialServiceLegacyMigration struct {
	StudentID     uint      `json:"student_id" gorm:"primaryKey"`
	MonthID       uint      `json:"month_id"`
	IncludeActual bool      `json:"include_actual"`
	CreatedBy     *uint     `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}
