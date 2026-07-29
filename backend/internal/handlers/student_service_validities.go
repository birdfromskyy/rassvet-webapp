package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type StudentServiceValidityHandler struct {
	db *gorm.DB
}

func NewStudentServiceValidityHandler(db *gorm.DB) *StudentServiceValidityHandler {
	return &StudentServiceValidityHandler{db: db}
}

func studentIDFromParam(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный ID ученика"})
		return 0, false
	}
	return uint(id), true
}

func validServiceType(serviceType string) bool {
	return serviceType == models.StudentServiceIppsu ||
		serviceType == models.StudentServiceAdaptivePhysicalCulture ||
		serviceType == models.StudentServiceMassage
}

// GetByStudent exposes only administrator-entered document-validity dates.
// They are informational and never participate in generation or slot checks.
func (h *StudentServiceValidityHandler) GetByStudent(c *gin.Context) {
	studentID, ok := studentIDFromParam(c)
	if !ok {
		return
	}
	var rows []models.StudentServiceValidity
	if err := h.db.Where("student_id = ?", studentID).Order("service_type").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить сроки услуг"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"validities": rows})
}

func (h *StudentServiceValidityHandler) Upsert(c *gin.Context) {
	studentID, ok := studentIDFromParam(c)
	if !ok {
		return
	}
	var body struct {
		ServiceType string `json:"service_type"`
		ValidUntil  string `json:"valid_until"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validServiceType(body.ServiceType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неизвестная услуга"})
		return
	}
	validUntil, err := time.Parse("2006-01-02", body.ValidUntil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите дату в формате ГГГГ-ММ-ДД"})
		return
	}

	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ученик не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить ученика"})
		return
	}
	actorID := c.GetUint("userID")
	if actorID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Требуется авторизация"})
		return
	}

	row := models.StudentServiceValidity{StudentID: studentID, ServiceType: body.ServiceType}
	lookup := h.db.Where("student_id = ? AND service_type = ?", studentID, body.ServiceType).First(&row)
	var before any
	if lookup.Error == nil {
		before = row
	} else if lookup.Error != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить срок услуги"})
		return
	}

	dateChanged := lookup.Error == gorm.ErrRecordNotFound ||
		row.ValidUntil.Format("2006-01-02") != validUntil.Format("2006-01-02")
	row.ValidUntil = validUntil
	// A changed date starts a new validity period, so both independent
	// notifications may be sent again for the new period. Saving the same date
	// must not create a duplicate notification.
	if dateChanged {
		row.NotifiedAt = nil
		row.ExpiringSoonNotifiedAt = nil
	}
	row.UpdatedByUserID = actorID
	if lookup.Error == nil {
		err = h.db.Save(&row).Error
	} else {
		err = h.db.Create(&row).Error
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить срок услуги"})
		return
	}

	logging.AdminMutation(c, "admin.student_service_validity.upsert", before, row)
	c.JSON(http.StatusOK, gin.H{"validity": row})
}

func (h *StudentServiceValidityHandler) Delete(c *gin.Context) {
	studentID, ok := studentIDFromParam(c)
	if !ok {
		return
	}
	serviceType := c.Param("serviceType")
	if !validServiceType(serviceType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неизвестная услуга"})
		return
	}

	var row models.StudentServiceValidity
	if err := h.db.Where("student_id = ? AND service_type = ?", studentID, serviceType).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Срок услуги не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить срок услуги"})
		return
	}
	if err := h.db.Delete(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить срок услуги"})
		return
	}
	logging.AdminMutation(c, "admin.student_service_validity.delete", row, nil)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
