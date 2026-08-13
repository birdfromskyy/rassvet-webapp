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
