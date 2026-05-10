package handlers

import (
	"backend/internal/models"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportHandler struct {
	db *gorm.DB
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

type monthlyStudentReportRow struct {
	StudentID   uint    `json:"student_id"`
	StudentName string  `json:"student_name"`
	SubjectID   uint    `json:"subject_id"`
	SubjectName string  `json:"subject_name"`
	DurationMin int     `json:"duration_min"`
	Lessons     int     `json:"lessons"`
	Hours       float64 `json:"hours"`
}

type monthlyTeacherReportRow struct {
	TeacherID   uint    `json:"teacher_id"`
	TeacherName string  `json:"teacher_name"`
	SubjectID   uint    `json:"subject_id"`
	SubjectName string  `json:"subject_name"`
	Duration30  int     `json:"duration_30"`
	Duration50  int     `json:"duration_50"`
	Lessons     int     `json:"lessons"`
	Hours       float64 `json:"hours"`
}

type reportLessonRow struct {
	Date        string  `json:"date"`
	Weekday     int     `json:"weekday"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	DurationMin int     `json:"duration_min"`
	Hours       float64 `json:"hours"`
	SlotType    string  `json:"slot_type"`
	StudentName string  `json:"student_name"`
	GroupName   string  `json:"group_name"`
	TeacherName string  `json:"teacher_name"`
	SubjectName string  `json:"subject_name"`
	RoomName    string  `json:"room_name"`
}

func (h *ReportHandler) GetMonthlyReport(c *gin.Context) {
	startDate, endDate, err := reportPeriod(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var teacherID uint
	var studentID uint
	if rawTeacherID := c.Query("teacher_id"); rawTeacherID != "" {
		parsedTeacherID, err := strconv.Atoi(rawTeacherID)
		if err != nil || parsedTeacherID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "teacher_id must be positive"})
			return
		}
		teacherID = uint(parsedTeacherID)
	}
	if rawStudentID := c.Query("student_id"); rawStudentID != "" {
		parsedStudentID, err := strconv.Atoi(rawStudentID)
		if err != nil || parsedStudentID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "student_id must be positive"})
			return
		}
		studentID = uint(parsedStudentID)
	}
	queryEnd := endDate.AddDate(0, 0, 1)

	var slots []models.ScheduleSlot
	query := h.db.Model(&models.ScheduleSlot{}).
		Joins("JOIN schedules ON schedules.id = schedule_slots.schedule_id").
		Preload("Schedule").
		Preload("Teacher").
		Preload("Student").
		Preload("Subject").
		Preload("Room").
		Preload("GroupLesson").
		Preload("GroupLesson.Enrollments").
		Preload("GroupLesson.Enrollments.Student").
		Preload("Exclusions").
		Where("schedules.status = ?", models.ScheduleStatusApproved).
		Where("schedule_slots.status <> ?", models.ScheduleSlotStatusCancelled).
		Where("schedules.week_start_date < ? AND schedules.week_end_date >= ?", queryEnd, startDate)
	if teacherID != 0 {
		query = query.Where("schedule_slots.teacher_id = ?", teacherID)
	}
	if err := query.
		Order("schedules.week_start_date ASC, schedule_slots.weekday ASC, schedule_slots.start_time ASC").
		Find(&slots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build monthly report"})
		return
	}

	studentRows := map[string]*monthlyStudentReportRow{}
	teacherRows := map[string]*monthlyTeacherReportRow{}
	lessons := []reportLessonRow{}
	durationCounts := map[string]int{"30": 0, "50": 0, "other": 0}

	for _, slot := range slots {
		lessonDate := slot.Schedule.WeekStartDate.AddDate(0, 0, slot.Weekday-1)
		if lessonDate.Before(startDate) || lessonDate.After(endDate) {
			continue
		}
		slotStudents := slotReportStudents(slot)
		if studentID != 0 && !reportSlotHasStudent(slotStudents, studentID) {
			continue
		}

		duration := slotDurationMinutes(slot)
		hours := reportHours(duration)
		subjectID := reportSubjectID(slot)
		subjectName := reportSubjectName(slot)

		teacherName := slot.Teacher.FullName
		if teacherName == "" {
			teacherName = strconv.Itoa(int(slot.TeacherID))
		}
		tKey := strconv.Itoa(int(slot.TeacherID)) + ":" + strconv.Itoa(int(subjectID)) + ":" + subjectName
		tRow := teacherRows[tKey]
		if tRow == nil {
			tRow = &monthlyTeacherReportRow{
				TeacherID:   slot.TeacherID,
				TeacherName: teacherName,
				SubjectID:   subjectID,
				SubjectName: subjectName,
			}
			teacherRows[tKey] = tRow
		}
		tRow.Lessons++
		tRow.Hours += hours
		switch duration {
		case 30:
			tRow.Duration30++
		case 50:
			tRow.Duration50++
		}

		switch duration {
		case 30:
			durationCounts["30"]++
		case 50:
			durationCounts["50"]++
		default:
			durationCounts["other"]++
		}
		groupName := ""
		if slot.GroupLesson != nil {
			groupName = slot.GroupLesson.Name
		}
		lessons = append(lessons, reportLessonRow{
			Date:        lessonDate.Format("2006-01-02"),
			Weekday:     slot.Weekday,
			StartTime:   slot.StartTime,
			EndTime:     slot.EndTime,
			DurationMin: duration,
			Hours:       hours,
			SlotType:    slot.SlotType,
			StudentName: reportSlotStudentLabel(slot),
			GroupName:   groupName,
			TeacherName: teacherName,
			SubjectName: subjectName,
			RoomName:    reportRoomName(slot),
		})

		for _, student := range slotStudents {
			studentName := student.FullName
			if studentName == "" {
				studentName = strconv.Itoa(int(student.ID))
			}
			sKey := strconv.Itoa(int(student.ID)) + ":" + strconv.Itoa(int(subjectID)) + ":" + subjectName + ":" + strconv.Itoa(duration)
			sRow := studentRows[sKey]
			if sRow == nil {
				sRow = &monthlyStudentReportRow{
					StudentID:   student.ID,
					StudentName: studentName,
					SubjectID:   subjectID,
					SubjectName: subjectName,
					DurationMin: duration,
				}
				studentRows[sKey] = sRow
			}
			sRow.Lessons++
			sRow.Hours += hours
		}
	}

	students := make([]monthlyStudentReportRow, 0, len(studentRows))
	for _, row := range studentRows {
		students = append(students, *row)
	}
	sort.Slice(students, func(i, j int) bool {
		if students[i].StudentName != students[j].StudentName {
			return students[i].StudentName < students[j].StudentName
		}
		if students[i].SubjectName != students[j].SubjectName {
			return students[i].SubjectName < students[j].SubjectName
		}
		return students[i].DurationMin < students[j].DurationMin
	})

	teachers := make([]monthlyTeacherReportRow, 0, len(teacherRows))
	for _, row := range teacherRows {
		teachers = append(teachers, *row)
	}
	sort.Slice(teachers, func(i, j int) bool {
		if teachers[i].TeacherName != teachers[j].TeacherName {
			return teachers[i].TeacherName < teachers[j].TeacherName
		}
		return teachers[i].SubjectName < teachers[j].SubjectName
	})
	sort.Slice(lessons, func(i, j int) bool {
		if lessons[i].Date != lessons[j].Date {
			return lessons[i].Date < lessons[j].Date
		}
		if lessons[i].StartTime != lessons[j].StartTime {
			return lessons[i].StartTime < lessons[j].StartTime
		}
		if lessons[i].TeacherName != lessons[j].TeacherName {
			return lessons[i].TeacherName < lessons[j].TeacherName
		}
		return lessons[i].SubjectName < lessons[j].SubjectName
	})

	c.JSON(http.StatusOK, gin.H{
		"period": gin.H{
			"start_date": startDate.Format("2006-01-02"),
			"end_date":   endDate.Format("2006-01-02"),
		},
		"students":        students,
		"teachers":        teachers,
		"lessons":         lessons,
		"duration_counts": durationCounts,
	})
}

func reportPeriod(c *gin.Context) (time.Time, time.Time, error) {
	if startRaw, endRaw := c.Query("start_date"), c.Query("end_date"); startRaw != "" || endRaw != "" {
		startDate, err := time.Parse("2006-01-02", startRaw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		endDate, err := time.Parse("2006-01-02", endRaw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		if endDate.Before(startDate) {
			return time.Time{}, time.Time{}, strconv.ErrSyntax
		}
		return startDate, endDate, nil
	}

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		return time.Time{}, time.Time{}, err
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		return time.Time{}, time.Time{}, err
	}
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	return startDate, startDate.AddDate(0, 1, -1), nil
}

func slotDurationMinutes(slot models.ScheduleSlot) int {
	start, err1 := time.Parse("15:04", slot.StartTime)
	end, err2 := time.Parse("15:04", slot.EndTime)
	if err1 != nil || err2 != nil || !end.After(start) {
		return 0
	}
	return int(end.Sub(start).Minutes())
}

func reportHours(durationMin int) float64 {
	switch durationMin {
	case 30:
		return 0.5
	case 50:
		return 1
	default:
		if durationMin <= 0 {
			return 0
		}
		return float64(durationMin) / 50
	}
}

func slotReportStudents(slot models.ScheduleSlot) []models.Student {
	if slot.SlotType == models.SlotTypeGroup {
		if slot.GroupLesson == nil {
			return nil
		}
		excluded := map[uint]bool{}
		for _, exclusion := range slot.Exclusions {
			excluded[exclusion.StudentID] = true
		}

		students := make([]models.Student, 0, len(slot.GroupLesson.Enrollments))
		for _, enrollment := range slot.GroupLesson.Enrollments {
			if excluded[enrollment.StudentID] {
				continue
			}
			student := enrollment.Student
			if student.ID == 0 {
				student.ID = enrollment.StudentID
			}
			students = append(students, student)
		}
		return students
	}

	if slot.Student != nil {
		return []models.Student{*slot.Student}
	}
	if slot.StudentID != nil {
		return []models.Student{{ID: *slot.StudentID}}
	}
	return nil
}

func reportSlotHasStudent(students []models.Student, studentID uint) bool {
	for _, student := range students {
		if student.ID == studentID {
			return true
		}
	}
	return false
}

func reportSlotStudentLabel(slot models.ScheduleSlot) string {
	if slot.SlotType == models.SlotTypeGroup {
		students := slotReportStudents(slot)
		names := ""
		for i, student := range students {
			if i > 0 {
				names += ", "
			}
			if student.FullName != "" {
				names += student.FullName
			} else {
				names += strconv.Itoa(int(student.ID))
			}
		}
		return names
	}

	if slot.Student != nil && slot.Student.FullName != "" {
		return slot.Student.FullName
	}
	if slot.StudentID != nil {
		return strconv.Itoa(int(*slot.StudentID))
	}
	return ""
}

func reportSubjectID(slot models.ScheduleSlot) uint {
	if slot.SubjectID != nil {
		return *slot.SubjectID
	}
	return 0
}

func reportSubjectName(slot models.ScheduleSlot) string {
	if slot.Subject != nil && slot.Subject.Name != "" {
		return slot.Subject.Name
	}
	if slot.SlotType == models.SlotTypeGroup {
		if slot.GroupLesson != nil && slot.GroupLesson.Name != "" {
			return slot.GroupLesson.Name
		}
		return "Групповое занятие"
	}
	if slot.SubjectID != nil {
		return strconv.Itoa(int(*slot.SubjectID))
	}
	return ""
}

func reportRoomName(slot models.ScheduleSlot) string {
	if slot.RoomName != "" {
		return slot.RoomName
	}
	if slot.Room != nil {
		return slot.Room.Name
	}
	if slot.RoomID != nil {
		return strconv.Itoa(int(*slot.RoomID))
	}
	return ""
}
