package utils

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	periodicityAlternativePattern = regexp.MustCompile(`(?i)\s+или\s+`)
	periodicityNumberPattern      = regexp.MustCompile(`\d+`)
)

// NormalizeSocialServicePeriodicity chooses the applicable value from a
// source expression containing alternatives. The source directory uses
// "ИЛИ" as a separator; normally the first value is retained, while an
// IPPSU reference means that the concrete alternative after it is used.
func NormalizeSocialServicePeriodicity(value string) string {
	parts := periodicityAlternativePattern.Split(strings.TrimSpace(value), 2)
	if len(parts) < 2 {
		return strings.TrimSpace(value)
	}
	if strings.Contains(strings.ToLower(parts[0]), "иппсу") {
		return strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(parts[0])
}

// SocialServiceMaximumMonthlyCount derives a monthly cap from a textual
// frequency. A month is treated as 31 days and four weeks for reporting.
func SocialServiceMaximumMonthlyCount(periodicity string) int {
	normalized := strings.ToLower(NormalizeSocialServicePeriodicity(periodicity))
	match := periodicityNumberPattern.FindString(normalized)
	if match == "" {
		return 0
	}
	count, err := strconv.Atoi(match)
	if err != nil || count < 0 {
		return 0
	}
	switch {
	case strings.Contains(normalized, "день"):
		return count * 31
	case strings.Contains(normalized, "недел"):
		return count * 4
	default:
		return count
	}
}
