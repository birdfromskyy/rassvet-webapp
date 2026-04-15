package models

type TeacherSubject struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	TeacherID uint `json:"teacher_id" gorm:"not null;uniqueIndex:idx_teacher_subject"`
	SubjectID uint `json:"subject_id" gorm:"not null;uniqueIndex:idx_teacher_subject"`

	Teacher Teacher `json:"teacher,omitempty" gorm:"foreignKey:TeacherID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Subject Subject `json:"subject,omitempty" gorm:"foreignKey:SubjectID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
