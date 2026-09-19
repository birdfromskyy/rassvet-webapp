package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestExpiryNotificationContentUpcoming(t *testing.T) {
	validUntil := time.Date(2026, time.September, 14, 0, 0, 0, 0, time.FixedZone("UTC+5", 5*60*60))

	title, body := ExpiryNotificationContent("ИППСУ", "Иванов Иван", validUntil, 21)

	require.Equal(t, "Через 21 день (14 сентября 2026)", title)
	require.Equal(t, "Истекает срок действия услуги «ИППСУ» у ребёнка «Иванов Иван».", body)
}

func TestExpiryNotificationContentUsesCorrectDayWord(t *testing.T) {
	validUntil := time.Date(2026, time.September, 14, 0, 0, 0, 0, time.UTC)

	title, _ := ExpiryNotificationContent("Массаж", "Иванов Иван", validUntil, 7)
	require.Equal(t, "Через 7 дней (14 сентября 2026)", title)

	title, _ = ExpiryNotificationContent("Адаптивная физкультура", "Иванов Иван", validUntil, 1)
	require.Equal(t, "Через 1 день (14 сентября 2026)", title)
}

func TestExpiryNotificationContentExpired(t *testing.T) {
	validUntil := time.Date(2026, time.September, 14, 0, 0, 0, 0, time.UTC)

	title, body := ExpiryNotificationContent("Массаж", "Иванов Иван", validUntil, 0)

	require.Equal(t, "Срок истёк (14 сентября 2026)", title)
	require.Equal(t, "Истёк срок действия услуги «Массаж» у ребёнка «Иванов Иван».", body)
}
