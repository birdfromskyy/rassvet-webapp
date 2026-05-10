package models

type TeacherRoom struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	TeacherID uint `json:"teacher_id" gorm:"not null;index;uniqueIndex:idx_teacher_room"`
	RoomID    uint `json:"room_id" gorm:"not null;index;uniqueIndex:idx_teacher_room"`
	IsStrict  bool `json:"is_strict" gorm:"not null;default:false"`

	Teacher Teacher `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Room    Room    `json:"room,omitempty" gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
