package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Email      string   `gorm:"unique;not null" json:"email"`
	Password   string   `gorm:"not null" json:"-"`
	FirstName  string   `gorm:"not null" json:"first_name"`
	LastName   string   `gorm:"not null" json:"last_name"`
	MiddleName string   `json:"middle_name"`
	Role       UserRole `gorm:"default:user" json:"role"`
	IsVerified bool     `gorm:"default:false" json:"is_verified"`

	Reviews []Review `json:"reviews,omitempty"`
}

type VerificationCode struct {
	ID        uint `gorm:"primarykey"`
	CreatedAt time.Time
	Email     string    `gorm:"not null"`
	Code      string    `gorm:"not null"`
	ExpiresAt time.Time `gorm:"not null"`
	Used      bool      `gorm:"default:false"`
}
