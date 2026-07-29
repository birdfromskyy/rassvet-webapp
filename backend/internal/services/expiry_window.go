package services

import "time"

// ExpiryReminderDates returns the two calendar dates which receive an
// upcoming-expiry notification: exactly one and exactly seven days ahead.
// The current day is deliberately excluded because an expiry notification is
// handled separately.
func ExpiryReminderDates(now time.Time) [2]time.Time {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return [2]time.Time{today.AddDate(0, 0, 1), today.AddDate(0, 0, 7)}
}
