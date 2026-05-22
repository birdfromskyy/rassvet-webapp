package models

import "time"

type Teacher struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	FullName  string    `json:"full_name" gorm:"type:varchar(255);not null"`
	IsActive  bool      `json:"is_active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// CMS fields for public /employees page
	Category       string `json:"category" gorm:"type:varchar(100)"`            // "Руководство" | "Специалисты"
	PhotoURL       string `json:"photo_url" gorm:"type:text"`
	Qualifications string `json:"qualifications" gorm:"type:text"`               // JSON array of strings
	Education      string `json:"education" gorm:"type:text"`                    // JSON array of strings
	Experience     string `json:"experience" gorm:"type:varchar(255)"`
	SortOrderCMS   int    `json:"sort_order_cms" gorm:"default:0"`
	ShowOnSite     bool   `json:"show_on_site" gorm:"default:false"`

	Subjects         []TeacherSubject          `json:"subjects,omitempty" gorm:"foreignKey:TeacherID"`
	Rooms            []TeacherRoom             `json:"rooms,omitempty" gorm:"foreignKey:TeacherID"`
	Availability     []TeacherAvailability     `json:"availability,omitempty" gorm:"foreignKey:TeacherID"`
	Assignments      []Assignment              `json:"assignments,omitempty" gorm:"foreignKey:TeacherID"`
	ScheduleSlots    []ScheduleSlot            `json:"schedule_slots,omitempty" gorm:"foreignKey:TeacherID"`
	GenerationIssues []ScheduleGenerationIssue `json:"generation_issues,omitempty" gorm:"foreignKey:TeacherID"`
}
