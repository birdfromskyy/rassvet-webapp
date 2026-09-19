package services

import (
	"fmt"
	"strings"
	"time"
)

var russianGenitiveMonths = [...]string{
	"января", "февраля", "марта", "апреля", "мая", "июня",
	"июля", "августа", "сентября", "октября", "ноября", "декабря",
}

// ExpiryNotificationContent returns the same concise wording for in-app and
// external notifications. The link remains a separate notification field, so
// VK renders it as its own paragraph and the site keeps the whole card clickable.
func ExpiryNotificationContent(serviceName, childName string, validUntil time.Time, daysBefore int) (string, string) {
	serviceName = strings.TrimSpace(serviceName)
	childName = strings.TrimSpace(childName)
	date := russianDate(validUntil)
	if daysBefore > 0 {
		return fmt.Sprintf("Через %d %s (%s)", daysBefore, russianDayWord(daysBefore), date),
			fmt.Sprintf("Истекает срок действия услуги «%s» у ребёнка «%s».", serviceName, childName)
	}
	return fmt.Sprintf("Срок истёк (%s)", date),
		fmt.Sprintf("Истёк срок действия услуги «%s» у ребёнка «%s».", serviceName, childName)
}

func russianDate(value time.Time) string {
	return fmt.Sprintf("%d %s %d", value.Day(), russianGenitiveMonths[value.Month()-1], value.Year())
}

func russianDayWord(days int) string {
	lastTwo := days % 100
	if lastTwo >= 11 && lastTwo <= 14 {
		return "дней"
	}
	switch days % 10 {
	case 1:
		return "день"
	case 2, 3, 4:
		return "дня"
	default:
		return "дней"
	}
}
