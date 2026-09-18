package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestStudentSocialServiceRejectsActualCountAboveMonthlyMaximum(t *testing.T) {
	e := newTestEnv(t)
	student := models.Student{FullName: "Тестовый ребёнок", FundingType: models.FundingTypeBudget, IsActive: true}
	directory := models.SocialService{Code: "Т.01", Category: "Тест", Name: "Тестовая услуга", StandardDurationMinutes: 30, Periodicity: "2 раза в месяц", TariffKopecks: 47429, IsActive: true}
	require.NoError(t, e.db.Create(&student).Error)
	require.NoError(t, e.db.Create(&directory).Error)
	h := NewSocialServiceHandler(e.db)

	callSelectStudentSocialServices(t, h, student.ID, fmt.Sprintf(`{"social_service_ids":[%d]}`, directory.ID))
	var selected models.StudentSocialService
	require.NoError(t, e.db.Where("student_id = ? AND social_service_id = ?", student.ID, directory.ID).First(&selected).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(student.ID)}, {Key: "serviceId", Value: fmt.Sprint(selected.ID)}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/admin/students/1/social-services/1", bytes.NewBufferString(`{
		"periodicity":"2 раза в месяц", "maximum_monthly_count":999, "actual_monthly_count":3,
		"standard_duration_minutes":30, "tariff_kopecks":47429
	}`))
	c.Request.Header.Set("Content-Type", "application/json")
	h.UpdateForStudent(c)
	require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
	require.Contains(t, w.Body.String(), "не может превышать")
}

func TestSelectingServiceCopiesDirectoryValuesOnlyOnce(t *testing.T) {
	e := newTestEnv(t)
	student := models.Student{FullName: "Тестовый ребёнок", FundingType: models.FundingTypeBudget, IsActive: true}
	directory := models.SocialService{Code: "Т.01", Category: "Тест", Name: "Тестовая услуга", StandardDurationMinutes: 30, Periodicity: "1 раз в месяц", TariffKopecks: 35571, IsActive: true}
	require.NoError(t, e.db.Create(&student).Error)
	require.NoError(t, e.db.Create(&directory).Error)
	h := NewSocialServiceHandler(e.db)
	callSelectStudentSocialServices(t, h, student.ID, fmt.Sprintf(`{"social_service_ids":[%d]}`, directory.ID))

	var selected models.StudentSocialService
	require.NoError(t, e.db.Where("student_id = ? AND social_service_id = ?", student.ID, directory.ID).First(&selected).Error)
	require.Equal(t, directory.Periodicity, selected.Periodicity)
	require.Equal(t, directory.TariffKopecks, selected.TariffKopecks)

	directory.Periodicity = "5 раз в месяц"
	directory.TariffKopecks = 99999
	require.NoError(t, e.db.Save(&directory).Error)
	callSelectStudentSocialServices(t, h, student.ID, fmt.Sprintf(`{"social_service_ids":[%d]}`, directory.ID))
	var unchanged models.StudentSocialService
	require.NoError(t, e.db.First(&unchanged, selected.ID).Error)
	require.Equal(t, "1 раз в месяц", unchanged.Periodicity)
	require.Equal(t, int64(35571), unchanged.TariffKopecks)
}

func callSelectStudentSocialServices(t *testing.T, h *SocialServiceHandler, studentID uint, body string) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(studentID)}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/admin/students/1/social-services", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	h.SelectForStudent(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
}
