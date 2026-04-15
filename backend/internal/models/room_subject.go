package models

type RoomSubject struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	RoomID    uint `json:"room_id" gorm:"not null;uniqueIndex:idx_room_subject"`
	SubjectID uint `json:"subject_id" gorm:"not null;uniqueIndex:idx_room_subject"`

	Room    Room    `json:"room,omitempty" gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Subject Subject `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
