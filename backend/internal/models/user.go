package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	RoleUser       UserRole = "user"
	RoleTeacher    UserRole = "teacher"
	RoleAdmin      UserRole = "admin"
	RoleSuperAdmin UserRole = "superadmin"
)

// IsAdminRole returns true for any role that has administrator-level access.
// Use this instead of hardcoding "admin" checks so that adding new privileged
// roles in the future only requires changing this one function.
func IsAdminRole(role string) bool {
	return role == string(RoleAdmin) || role == string(RoleSuperAdmin)
}

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

	ConsentGivenAt *time.Time `json:"consent_given_at"`
	ConsentVersion string     `json:"consent_version"`

	Reviews []Review `json:"reviews,omitempty"`
}

