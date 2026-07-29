package handlers

import (
	"backend/internal/models"
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createReportTariffRuleForTest(t *testing.T, e *testEnv, slotType string, subjectID *uint, duration, price int, active bool) models.ReportTariffRule {
	t.Helper()
	tariffDuration := duration
	tariffPrice := price
	tariff := models.CommercialTariff{
		ServiceName: "Тестовый тариф", VolumeLabel: "Тест", DurationMinutes: &tariffDuration,
		PriceRub: &tariffPrice, EffectiveFrom: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), IsActive: true,
	}
	require.NoError(t, e.db.Create(&tariff).Error)
	rule := models.ReportTariffRule{
		SlotType: slotType, SubjectID: subjectID, DurationMinutes: duration,
		CommercialTariffID: tariff.ID, IsActive: active,
	}
	require.NoError(t, e.db.Create(&rule).Error)
	require.NoError(t, e.db.Model(&rule).UpdateColumn("is_active", active).Error)
	return rule
}

func clearReportTariffRulesForTest(t *testing.T, e *testEnv) {
	t.Helper()
	require.NoError(t, e.db.Where("1 = 1").Delete(&models.ReportTariffRule{}).Error)
}

func TestResolveReportTariff_GroupRuleIgnoresSubject(t *testing.T) {
	e := newTestEnv(t)
	clearReportTariffRulesForTest(t, e)
	firstSubject := &models.Subject{Name: "Первый", DefaultDurationMin: 30, IsActive: true}
	secondSubject := &models.Subject{Name: "Второй", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(firstSubject).Error)
	require.NoError(t, e.db.Create(secondSubject).Error)
	createReportTariffRuleForTest(t, e, models.SlotTypeGroup, nil, 60, 600, true)

	lookup, err := loadActiveReportTariffLookup(e.db)
	require.NoError(t, err)
	match := resolveReportTariff(lookup, models.SlotTypeGroup, &secondSubject.ID, 60)
	require.True(t, match.Covered)
	require.NotNil(t, match.TariffRub)
	assert.Equal(t, 600, *match.TariffRub)
}

func TestResolveReportTariff_InactiveRuleDoesNotCoverLesson(t *testing.T) {
	e := newTestEnv(t)
	clearReportTariffRulesForTest(t, e)
	subject := &models.Subject{Name: "Психолог", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(subject).Error)
	rule := createReportTariffRuleForTest(t, e, models.SlotTypeIndividual, &subject.ID, 30, 1320, false)
	var stored models.ReportTariffRule
	require.NoError(t, e.db.First(&stored, rule.ID).Error)
	require.False(t, stored.IsActive, "the helper must create the rule explicitly disabled")

	lookup, err := loadActiveReportTariffLookup(e.db)
	require.NoError(t, err)
	match := resolveReportTariff(lookup, models.SlotTypeIndividual, &subject.ID, 30)
	assert.False(t, match.Covered)
}

func TestRequireReportTariffAcknowledgementRequiresExplicitConfirmation(t *testing.T) {
	e := newTestEnv(t)
	clearReportTariffRulesForTest(t, e)
	subject := &models.Subject{Name: "Без тарифа", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(subject).Error)
	h := NewScheduleHandler(e.db, nil)
	slot := models.ScheduleSlot{SlotType: models.SlotTypeIndividual, SubjectID: &subject.ID, StartTime: "09:00", EndTime: "09:40"}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	match, allowed := h.requireReportTariffAcknowledgement(c, slot, false)
	assert.False(t, allowed)
	assert.False(t, match.Covered)
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	match, allowed = h.requireReportTariffAcknowledgement(c, slot, true)
	assert.True(t, allowed)
	assert.False(t, match.Covered)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCreateReportTariffRuleKeepsInitialInactiveStatus(t *testing.T) {
	e := newTestEnv(t)
	clearReportTariffRulesForTest(t, e)
	subject := &models.Subject{Name: "Тарифный предмет", DefaultDurationMin: 30, IsActive: true}
	require.NoError(t, e.db.Create(subject).Error)
	duration, price := 30, 1320
	tariff := &models.CommercialTariff{
		ServiceName: "Психолог", VolumeLabel: "30 мин", DurationMinutes: &duration, PriceRub: &price,
		EffectiveFrom: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), IsActive: true,
	}
	require.NoError(t, e.db.Create(tariff).Error)

	body := []byte(`{"slot_type":"individual","subject_id":` + itoa(subject.ID) + `,"duration_minutes":30,"commercial_tariff_id":` + itoa(tariff.ID) + `,"is_active":false}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/admin/report-tariff-rules", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	NewReportTariffRuleHandler(e.db).Create(c)

	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var created models.ReportTariffRule
	require.NoError(t, e.db.Last(&created).Error)
	assert.False(t, created.IsActive)
}

func TestReportTariffRuleAllowsPausedSubject(t *testing.T) {
	e := newTestEnv(t)
	clearReportTariffRulesForTest(t, e)
	subject := &models.Subject{Name: "Предмет на паузе", DefaultDurationMin: 30, IsActive: false}
	require.NoError(t, e.db.Create(subject).Error)
	duration, price := 30, 1320
	tariff := &models.CommercialTariff{
		ServiceName: "Тестовый тариф", VolumeLabel: "30 мин", DurationMinutes: &duration, PriceRub: &price,
		EffectiveFrom: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), IsActive: true,
	}
	require.NoError(t, e.db.Create(tariff).Error)

	h := NewReportTariffRuleHandler(e.db)
	message := h.validate(reportTariffRuleRequest{
		SlotType: models.SlotTypeIndividual, SubjectID: &subject.ID, DurationMinutes: duration,
		CommercialTariffID: tariff.ID,
	}, 0)
	assert.Empty(t, message)
}
