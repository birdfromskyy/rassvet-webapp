package models

type TeacherAvailability struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	TeacherID uint   `json:"teacher_id" gorm:"not null;index:idx_teacher_weekday"`
	Weekday   int    `json:"weekday" gorm:"not null;index:idx_teacher_weekday"` // 1=Mon ... 6=Sat
	StartTime string `json:"start_time" gorm:"type:varchar(5);not null"`        // HH:MM
	EndTime   string `json:"end_time" gorm:"type:varchar(5);not null"`          // HH:MM

	Teacher Teacher `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
