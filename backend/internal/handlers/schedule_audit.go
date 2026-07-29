package handlers

import (
	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

// These deliberately small snapshots keep Docker audit events readable and
// avoid leaking CMS text, photos or other unrelated data.
func subjectAuditSnapshot(subject models.Subject) gin.H {
	return gin.H{"id": subject.ID, "name": subject.Name, "default_duration_min": subject.DefaultDurationMin, "minimum_teacher_break_minutes": subject.MinimumTeacherBreakMinutes, "is_active": subject.IsActive, "archived": subject.ArchivedAt != nil}
}

func teacherAuditSnapshot(teacher models.Teacher) gin.H {
	return gin.H{"id": teacher.ID, "full_name": teacher.FullName, "is_active": teacher.IsActive, "archived": teacher.ArchivedAt != nil}
}

func studentAuditSnapshot(student models.Student) gin.H {
	return gin.H{"id": student.ID, "full_name": student.FullName, "funding_type": student.FundingType, "is_active": student.IsActive, "allow_schedule_windows": student.AllowScheduleWindows, "archived": student.ArchivedAt != nil}
}

func roomAuditSnapshot(room models.Room) gin.H {
	return gin.H{"id": room.ID, "name": room.Name, "is_active": room.IsActive, "archived": room.ArchivedAt != nil}
}

func assignmentAuditSnapshot(assignment models.Assignment) gin.H {
	return gin.H{"id": assignment.ID, "student_id": assignment.StudentID, "teacher_id": assignment.TeacherID, "subject_id": assignment.SubjectID, "funding_type": assignment.FundingType, "visits_per_week": assignment.VisitsPerWeek, "duration_min": assignment.DurationMin, "status": assignment.Status, "archived": assignment.ArchivedAt != nil}
}

func groupLessonAuditSnapshot(lesson models.GroupLesson) gin.H {
	teacherIDs := make([]uint, 0, len(lesson.Teachers))
	for _, teacher := range lesson.Teachers {
		teacherIDs = append(teacherIDs, teacher.TeacherID)
	}
	return gin.H{"id": lesson.ID, "name": lesson.Name, "subject_id": lesson.SubjectID, "teacher_ids": teacherIDs, "teacher_hours_mode": lesson.TeacherHoursMode, "room_name": lesson.RoomName, "visits_per_week": lesson.VisitsPerWeek, "duration_min": lesson.DurationMin, "max_students": lesson.MaxStudents, "status": lesson.Status, "ignore_student_windows": lesson.IgnoreStudentWindows, "archived": lesson.ArchivedAt != nil}
}

func commercialTariffAuditSnapshot(tariff models.CommercialTariff) gin.H {
	return gin.H{"id": tariff.ID, "service_name": tariff.ServiceName, "volume_label": tariff.VolumeLabel, "duration_minutes": tariff.DurationMinutes, "price_rub": tariff.PriceRub, "price_note": tariff.PriceNote, "sort_order": tariff.SortOrder, "is_active": tariff.IsActive}
}

func reportTariffRuleAuditSnapshot(rule models.ReportTariffRule) gin.H {
	return gin.H{"id": rule.ID, "subject_id": rule.SubjectID, "slot_type": rule.SlotType, "duration_minutes": rule.DurationMinutes, "commercial_tariff_id": rule.CommercialTariffID, "is_active": rule.IsActive}
}
