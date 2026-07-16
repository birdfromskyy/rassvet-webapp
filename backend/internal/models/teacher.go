package models

import "time"

type Teacher struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	FullName  string    `json:"full_name" gorm:"type:varchar(255);not null"`
	IsActive  bool      `json:"is_active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Legacy link retained for backwards-compatible data migration. New code
	// uses TeacherUserLink so one teacher may have several employee accounts.
	UserID    *uint             `json:"user_id,omitempty" gorm:"uniqueIndex"`
	UserLinks []TeacherUserLink `json:"user_links,omitempty" gorm:"foreignKey:TeacherID"`

	// CMS fields for public /employees page
	Category       string `json:"category" gorm:"type:text"`
	PhotoURL       string `json:"photo_url" gorm:"type:text"`
	Qualifications string `json:"qualifications" gorm:"type:text"` // JSON array of strings
	Education      string `json:"education" gorm:"type:text"`      // JSON array of strings
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

// TeacherUserLink connects one teacher with employee accounts. A user may be
// linked to at most one teacher; a teacher may be linked to many users.
type TeacherUserLink struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	TeacherID uint      `json:"teacher_id" gorm:"not null;uniqueIndex:idx_teacher_user_link"`
	Teacher   Teacher   `json:"-" gorm:"foreignKey:TeacherID"`
	UserID    uint      `json:"user_id" gorm:"not null;uniqueIndex:idx_teacher_user_link;uniqueIndex:idx_teacher_user_one_user"`
	CreatedAt time.Time `json:"created_at"`
}
