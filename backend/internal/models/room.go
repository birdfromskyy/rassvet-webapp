package models

import "time"

type Room struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"type:varchar(255);not null;uniqueIndex"`
	IsActive  bool      `json:"is_active" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Subjects      []RoomSubject  `json:"subjects,omitempty" gorm:"foreignKey:RoomID"`
	ScheduleSlots []ScheduleSlot `json:"schedule_slots,omitempty" gorm:"foreignKey:RoomID"`
}
