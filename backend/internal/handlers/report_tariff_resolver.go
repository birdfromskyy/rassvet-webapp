package handlers

import (
	"backend/internal/models"
	"strconv"

	"gorm.io/gorm"
)

// reportTariffMatch is the single source of truth for both the report and the
// manual-slot warning. A covered tariff may legitimately have a price of zero;
// coverage means that an active rule exists, not that the price is non-zero.
type reportTariffMatch struct {
	Covered            bool   `json:"covered"`
	RuleID             uint   `json:"rule_id,omitempty"`
	CommercialTariffID uint   `json:"commercial_tariff_id,omitempty"`
	TariffRub          *int   `json:"tariff_rub,omitempty"`
	SlotType           string `json:"slot_type"`
	SubjectID          *uint  `json:"subject_id,omitempty"`
	DurationMinutes    int    `json:"duration_minutes"`
}

func reportTariffKey(slotType string, subjectID uint, durationMinutes int) string {
	return slotType + ":" + strconv.Itoa(int(subjectID)) + ":" + strconv.Itoa(durationMinutes)
}

func loadActiveReportTariffLookup(db *gorm.DB) (map[string]reportTariffMatch, error) {
	var rules []models.ReportTariffRule
	if err := db.Preload("CommercialTariff").Where("is_active = ?", true).Find(&rules).Error; err != nil {
		return nil, err
	}

	lookup := make(map[string]reportTariffMatch, len(rules))
	for _, rule := range rules {
		// A rule with no numeric price cannot produce a payable report row.
		// This should be impossible through the admin validation, but keeping
		// the guard here makes the warning and report agree for legacy data.
		if rule.CommercialTariff.PriceRub == nil {
			continue
		}
		subjectID := uint(0)
		if rule.SubjectID != nil {
			subjectID = *rule.SubjectID
		}
		lookup[reportTariffKey(rule.SlotType, subjectID, rule.DurationMinutes)] = reportTariffMatch{
			Covered:            true,
			RuleID:             rule.ID,
			CommercialTariffID: rule.CommercialTariffID,
			TariffRub:          rule.CommercialTariff.PriceRub,
			SlotType:           rule.SlotType,
			SubjectID:          rule.SubjectID,
			DurationMinutes:    rule.DurationMinutes,
		}
	}
	return lookup, nil
}

func resolveReportTariff(lookup map[string]reportTariffMatch, slotType string, subjectID *uint, durationMinutes int) reportTariffMatch {
	lookupSubjectID := uint(0)
	if slotType == models.SlotTypeIndividual && subjectID != nil {
		lookupSubjectID = *subjectID
	}
	if match, ok := lookup[reportTariffKey(slotType, lookupSubjectID, durationMinutes)]; ok {
		return match
	}
	return reportTariffMatch{
		Covered:         false,
		SlotType:        slotType,
		SubjectID:       subjectID,
		DurationMinutes: durationMinutes,
	}
}
