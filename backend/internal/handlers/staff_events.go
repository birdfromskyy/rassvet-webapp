package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"backend/internal/services"
	"backend/internal/services/reporting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

func RegisterStaffDatesRoutes(admin *gin.RouterGroup, db *gorm.DB) {
	h := staffDatesHandler{db}
	admin.GET("/staff-dates", h.list)
	admin.PUT("/staff-dates/:kind/:id", h.save)
	admin.GET("/staff-reminder-recipients", h.preferences)
	admin.PUT("/staff-reminder-recipients/:id", h.savePreference)
}

type staffDatesHandler struct{ db *gorm.DB }

func (h staffDatesHandler) list(c *gin.Context) {
	rows, err := services.ListStaff(h.db, time.Now())
	if err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"staff": rows, "timezone": "Asia/Yekaterinburg", "reminder_hour": 9})
}
func (h staffDatesHandler) save(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	kind := c.Param("kind")
	if kind != "teacher" && kind != "user" {
		c.JSON(400, gin.H{"error": "Неизвестный тип сотрудника"})
		return
	}
	var in struct {
		Revision     int64        `json:"revision"`
		BirthDate    *models.Date `json:"birth_date"`
		MedicalUntil *models.Date `json:"medical_until"`
	}
	if !reportingBody(c, &in, "revision", "birth_date", "medical_until") {
		return
	}
	if err := reporting.ValidateBirthDate(in.BirthDate); err != nil {
		reportingError(c, err)
		return
	}
	var saved models.StaffDates
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if kind == "teacher" {
			var owner models.Teacher
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&owner, id).Error; err != nil {
				return err
			}
		} else {
			var owner models.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&owner, id).Error; err != nil {
				return err
			}
		}
		staff, err := services.ListStaff(tx, time.Now())
		if err != nil {
			return err
		}
		found := false
		for _, row := range staff {
			if row.Kind == kind && row.OwnerID == id {
				found = true
				break
			}
		}
		if !found {
			return &reporting.Error{Status: 400, Message: "Выберите сотрудника из актуального списка"}
		}
		column := "teacher_id"
		if kind == "user" {
			column = "user_id"
		}
		err = tx.Where(column+" = ?", id).First(&saved).Error
		if err == gorm.ErrRecordNotFound {
			if in.Revision != 0 {
				return &reporting.Error{Status: 409, Message: "Обновите данные сотрудника"}
			}
			saved.Revision = 1
			if kind == "teacher" {
				saved.TeacherID = &id
			} else {
				saved.UserID = &id
			}
		} else if err != nil {
			return err
		} else {
			if in.Revision == 0 {
				return &reporting.Error{Status: 409, Message: "Даты уже сохранены. Обновите список"}
			}
			if err = reporting.CheckRevision(in.Revision, saved.Revision); err != nil {
				return err
			}
			saved.Revision++
		}
		saved.BirthDate = in.BirthDate
		saved.MedicalUntil = in.MedicalUntil
		return tx.Omit("Teacher", "User").Save(&saved).Error
	})
	if err != nil {
		reportingError(c, err)
		return
	}
	logging.AdminMutation(c, "staff.dates.update", nil, gin.H{"kind": kind, "owner_id": id, "revision": saved.Revision})
	c.JSON(200, gin.H{"dates": saved})
}

type staffRecipientView struct {
	ID         uint   `json:"id"`
	ProfileURL string `json:"profile_url"`
	Enabled    bool   `json:"enabled"`
	Medical    bool   `json:"medical"`
	Birthdays  bool   `json:"birthdays"`
	Revision   int64  `json:"revision"`
}

func (h staffDatesHandler) preferences(c *gin.Context) {
	rows := []staffRecipientView{}
	err := h.db.Raw(`SELECT r.id,r.profile_url,r.is_enabled AS enabled,coalesce(p.medical,false) AS medical,
		coalesce(p.birthdays,false) AS birthdays,coalesce(p.revision,0) AS revision
		FROM vk_notification_recipients r LEFT JOIN staff_reminder_preferences p ON p.recipient_id=r.id ORDER BY r.id`).Scan(&rows).Error
	if err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"recipients": rows})
}
func (h staffDatesHandler) savePreference(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in struct {
		Revision  int64 `json:"revision"`
		Medical   bool  `json:"medical"`
		Birthdays bool  `json:"birthdays"`
	}
	if !reportingBody(c, &in, "revision", "medical", "birthdays") {
		return
	}
	var pref models.StaffReminderPreference
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var recipient models.VKNotificationRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&recipient, id).Error; err != nil {
			return err
		}
		err := tx.First(&pref, id).Error
		if err == gorm.ErrRecordNotFound {
			if in.Revision != 0 {
				return &reporting.Error{Status: 409, Message: "Обновите настройки"}
			}
			pref.RecipientID = id
			pref.Revision = 1
		} else if err != nil {
			return err
		} else {
			if in.Revision == 0 {
				return &reporting.Error{Status: 409, Message: "Настройки уже сохранены. Обновите список"}
			}
			if err = reporting.CheckRevision(in.Revision, pref.Revision); err != nil {
				return err
			}
			pref.Revision++
		}
		pref.Medical = in.Medical
		pref.Birthdays = in.Birthdays
		return tx.Omit("Recipient").Save(&pref).Error
	})
	if err != nil {
		reportingError(c, err)
		return
	}
	logging.AdminMutation(c, "staff.reminders.configure", nil, gin.H{"recipient_id": id, "medical": pref.Medical, "birthdays": pref.Birthdays})
	c.JSON(200, gin.H{"preference": pref})
}
