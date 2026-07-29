package handlers

import (
	"backend/internal/models"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreateCommercialTariffKeepsInitialHiddenStatus(t *testing.T) {
	e := newTestEnv(t)
	h := NewCommercialTariffHandler(e.db)
	body := []byte(`{
		"service_name":"Тестовая услуга",
		"volume_label":"30 мин",
		"price_rub":1000,
		"effective_from":"2026-01-01T00:00:00Z",
		"is_active":false
	}`)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/admin/commercial-tariffs", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	h.CreateCommercialTariff(c)

	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var created models.CommercialTariff
	// The shared test database retains rows from previous tests, therefore the
	// first row is not necessarily the tariff created by this request.
	require.NoError(t, e.db.Order("id DESC").First(&created).Error)
	require.False(t, created.IsActive)
}

func TestGetStudentsIncludesServiceValidityCount(t *testing.T) {
	e := newTestEnv(t)
	student := models.Student{FullName: "Тестовый ученик", FundingType: models.FundingTypeBudget, IsActive: true}
	require.NoError(t, e.db.Create(&student).Error)
	for _, serviceType := range []string{
		models.StudentServiceIppsu,
		models.StudentServiceAdaptivePhysicalCulture,
		models.StudentServiceMassage,
	} {
		require.NoError(t, e.db.Create(&models.StudentServiceValidity{
			StudentID: student.ID, ServiceType: serviceType,
			ValidUntil: time.Date(2026, time.December, 31, 0, 0, 0, 0, time.UTC), UpdatedByUserID: 1,
		}).Error)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/students", nil)
	NewStudentHandler(e.db).GetStudents(c)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var response struct {
		Students []models.Student `json:"students"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Len(t, response.Students, 1)
	require.Equal(t, 3, response.Students[0].ValidityCount)
}
