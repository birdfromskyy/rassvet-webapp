package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUpsertStudentServiceValidityResetsNotificationMarksOnlyForNewDate(t *testing.T) {
	e := newTestEnv(t)
	student := models.Student{FullName: "Тестовый ученик", FundingType: models.FundingTypeBudget, IsActive: true}
	require.NoError(t, e.db.Create(&student).Error)

	notifiedAt := time.Date(2026, time.July, 1, 10, 0, 0, 0, time.UTC)
	reminderAt := time.Date(2026, time.June, 24, 10, 0, 0, 0, time.UTC)
	validity := models.StudentServiceValidity{
		StudentID:                student.ID,
		ServiceType:              models.StudentServiceMassage,
		ValidUntil:               time.Date(2026, time.August, 5, 0, 0, 0, 0, time.UTC),
		NotifiedAt:               &notifiedAt,
		ExpiringSoonNotifiedAt:   &reminderAt,
		Expiring21DaysNotifiedAt: &reminderAt,
		Expiring7DaysNotifiedAt:  &reminderAt,
		Expiring1DayNotifiedAt:   &reminderAt,
		UpdatedByUserID:          1,
	}
	require.NoError(t, e.db.Create(&validity).Error)
	h := NewStudentServiceValidityHandler(e.db)

	callUpsertServiceValidity(t, h, student.ID, `{"service_type":"massage","valid_until":"2026-08-05"}`)
	var unchanged models.StudentServiceValidity
	require.NoError(t, e.db.First(&unchanged, validity.ID).Error)
	require.NotNil(t, unchanged.NotifiedAt)
	require.NotNil(t, unchanged.ExpiringSoonNotifiedAt)
	require.NotNil(t, unchanged.Expiring21DaysNotifiedAt)
	require.NotNil(t, unchanged.Expiring7DaysNotifiedAt)
	require.NotNil(t, unchanged.Expiring1DayNotifiedAt)

	callUpsertServiceValidity(t, h, student.ID, `{"service_type":"massage","valid_until":"2026-08-12"}`)
	var changed models.StudentServiceValidity
	require.NoError(t, e.db.First(&changed, validity.ID).Error)
	require.Nil(t, changed.NotifiedAt)
	require.Nil(t, changed.ExpiringSoonNotifiedAt)
	require.Nil(t, changed.Expiring21DaysNotifiedAt)
	require.Nil(t, changed.Expiring7DaysNotifiedAt)
	require.Nil(t, changed.Expiring1DayNotifiedAt)
}

func TestListStudentServiceValiditiesFiltersAndSortsByDeadline(t *testing.T) {
	e := newTestEnv(t)
	first := models.Student{FullName: "Алексей Тестов", FundingType: models.FundingTypeBudget, IsActive: true}
	second := models.Student{FullName: "Борис Тестов", FundingType: models.FundingTypeBudget, IsActive: true}
	require.NoError(t, e.db.Create(&first).Error)
	require.NoError(t, e.db.Create(&second).Error)
	require.NoError(t, e.db.Create(&[]models.StudentServiceValidity{
		{StudentID: first.ID, ServiceType: models.StudentServiceIppsu, ValidUntil: time.Date(2026, time.August, 5, 0, 0, 0, 0, time.UTC), UpdatedByUserID: 1},
		{StudentID: first.ID, ServiceType: models.StudentServiceMassage, ValidUntil: time.Date(2026, time.July, 28, 0, 0, 0, 0, time.UTC), UpdatedByUserID: 1},
		{StudentID: second.ID, ServiceType: models.StudentServiceMassage, ValidUntil: time.Date(2026, time.July, 20, 0, 0, 0, 0, time.UTC), UpdatedByUserID: 1},
	}).Error)

	h := NewStudentServiceValidityHandler(e.db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/student-service-validities?student=%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B5%D0%B9&service_type=massage&sort=desc", nil)
	h.List(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.Contains(t, w.Body.String(), `"full_name":"Алексей Тестов"`)
	require.Contains(t, w.Body.String(), `"service_type":"massage"`)
	require.NotContains(t, w.Body.String(), "Борис Тестов")

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/student-service-validities?sort=asc", nil)
	h.List(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	// The earliest date must be emitted before later dates.
	earliestIndex := bytes.Index(w.Body.Bytes(), []byte(`"valid_until":"2026-07-20`))
	laterIndex := bytes.Index(w.Body.Bytes(), []byte(`"valid_until":"2026-07-28`))
	require.NotEqual(t, -1, earliestIndex)
	require.NotEqual(t, -1, laterIndex)
	require.Less(t, earliestIndex, laterIndex)
}

func callUpsertServiceValidity(t *testing.T, h *StudentServiceValidityHandler, studentID uint, body string) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(studentID)}}
	c.Set("userID", uint(1))
	c.Request = httptest.NewRequest(http.MethodPut, "/api/admin/students/1/service-validities", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	h.Upsert(c)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
}
