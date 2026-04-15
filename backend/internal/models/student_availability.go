package models

type StudentAvailability struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	StudentID uint   `json:"student_id" gorm:"not null;index:idx_student_weekday"`
	Weekday   int    `json:"weekday" gorm:"not null;index:idx_student_weekday"` // 1=Mon ... 6=Sat
	StartTime string `json:"start_time" gorm:"type:varchar(5);not null"`        // HH:MM
	EndTime   string `json:"end_time" gorm:"type:varchar(5);not null"`          // HH:MM

	Student Student `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
