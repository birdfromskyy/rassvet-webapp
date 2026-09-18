package reporting

import (
	"backend/internal/models"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return e.Message }
func invalid(s string) error   { return &Error{400, s} }
func conflict(s string) error  { return &Error{409, s} }
func CheckRevision(expected, actual int64) error {
	if expected <= 0 {
		return &Error{428, "Необходима revision прочитанной записи"}
	}
	if expected != actual {
		return conflict("Запись уже изменена. Обновите данные перед сохранением")
	}
	return nil
}
func ValidateMonth(d models.Date) error {
	t, err := d.Time()
	if err != nil || t.Day() != 1 || t.Year() < 1 || t.Year() > 9998 {
		return invalid("Месяц должен иметь формат YYYY-MM-01")
	}
	return nil
}
func ValidatePerson(last, first, middle string, dob *models.Date) error {
	if strings.TrimSpace(last) == "" || strings.TrimSpace(first) == "" {
		return invalid("Необходимы фамилия и имя")
	}
	for _, s := range []string{last, first, middle} {
		if utf8.RuneCountInString(s) > 80 {
			return invalid("Часть ФИО длиннее 80 символов")
		}
	}
	return ValidateBirthDate(dob)
}
func ValidateBirthDate(dob *models.Date) error {
	if dob == nil {
		return nil
	}
	t, err := dob.Time()
	if err != nil || t.Year() < 1 || string(*dob) > time.Now().Format("2006-01-02") {
		return invalid("Некорректная дата рождения")
	}
	return nil
}
func FullName(last, first, middle string) string {
	return strings.TrimSpace(last + " " + first + " " + middle)
}

var frequencyPattern = regexp.MustCompile(`(?i)^(\d+)\s+(?:раз|раза)\s+в\s+(день|неделю|месяц)$`)

// Unknown text is preserved, never interpreted using its first number. A
// human-specified maximum is mandatory for such a periodicity.
func Frequency(text string, manual *int) (*int, string, int, error) {
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > 255 {
		return nil, "", 0, invalid("Некорректная периодичность")
	}
	m := frequencyPattern.FindStringSubmatch(strings.Join(strings.Fields(text), " "))
	if m == nil {
		if manual == nil || *manual < 0 || *manual > 100000 {
			return nil, "", 0, invalid("Для этой периодичности укажите максимум явно")
		}
		return nil, "manual", *manual, nil
	}
	n, err := strconv.Atoi(m[1])
	if err != nil || n < 1 || n > 100000 {
		return nil, "", 0, invalid("Некорректная частота")
	}
	unit, factor := "month", 1
	switch strings.ToLower(m[2]) {
	case "день":
		unit, factor = "day", 31
	case "неделю":
		unit, factor = "week", 4
	}
	maximum := n * factor
	if maximum > 100000 {
		return nil, "", 0, invalid("Слишком большой максимум")
	}
	if manual != nil && *manual != maximum {
		return nil, "", 0, invalid(fmt.Sprintf("Максимум по периодичности — %d", maximum))
	}
	return &n, unit, maximum, nil
}

type Totals struct {
	Services int64 `json:"services"`
	Minutes  int64 `json:"minutes"`
	Kopecks  int64 `json:"kopecks"`
	Unfilled int   `json:"unfilled"`
}

func Calculate(items []models.StudentServiceMonthItem) Totals {
	var t Totals
	for _, i := range items {
		if i.ActualMonthlyCount == nil {
			t.Unfilled++
			continue
		}
		n := int64(*i.ActualMonthlyCount)
		t.Services += n
		t.Minutes += n * int64(i.StandardDurationMinutes)
		t.Kopecks += n * i.TariffKopecks
	}
	return t
}
