package reporting

import (
	"backend/internal/models"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestFrequency(t *testing.T) {
	manual := 17
	for _, tt := range []struct {
		text   string
		manual *int
		want   int
		unit   string
		bad    bool
	}{
		{"2 раза в неделю", nil, 8, "week", false},
		{"3 раза в неделю", nil, 12, "week", false},
		{"1 раз в месяц", nil, 1, "month", false},
		{"2 раза в день", nil, 62, "day", false},
		{"  3  раза  в неделю ", nil, 12, "week", false},
		{"по назначению врача", nil, 0, "", true},
		{"1 в соответствии с ИППСУ", nil, 0, "", true},
		{"10 раз за курс", nil, 0, "", true},
		{"10 раз за курс", &manual, 17, "manual", false},
		{"2 раза в неделю ИЛИ 1 раз в день", nil, 0, "", true},
		{"2 раза в неделю", &manual, 0, "", true},
		{"0 раз в неделю", nil, 0, "", true},
		{"9999999999999999999999999 раз в день", nil, 0, "", true},
	} {
		t.Run(tt.text, func(t *testing.T) {
			_, unit, n, err := Frequency(tt.text, tt.manual)
			if tt.bad {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, n)
			require.Equal(t, tt.unit, unit)
		})
	}
}
func TestCalendarDatesAndMonth(t *testing.T) {
	for _, s := range []string{"2026-01-01", "2025-12-01", "2024-02-01"} {
		require.NoError(t, ValidateMonth(models.Date(s)))
	}
	for _, s := range []string{"2026-01-02", "2026-02-29", "2026-1-01", "2026-01-01T00:00:00Z", "0000-01-01"} {
		require.Error(t, ValidateMonth(models.Date(s)))
	}
	var d models.Date
	require.NoError(t, json.Unmarshal([]byte(`"2024-02-29"`), &d))
	v, err := d.Value()
	require.NoError(t, err)
	require.Equal(t, "2024-02-29", v)
	require.Error(t, json.Unmarshal([]byte(`"2026-02-29"`), &d))
}
func TestIntegerTotalsAndUnfilled(t *testing.T) {
	zero, ten := 0, 10
	totals := Calculate([]models.StudentServiceMonthItem{{ActualMonthlyCount: nil}, {ActualMonthlyCount: &zero, TariffKopecks: 35571}, {ActualMonthlyCount: &ten, StandardDurationMinutes: 30, TariffKopecks: 35571}})
	require.Equal(t, Totals{Services: 10, Minutes: 300, Kopecks: 355710, Unfilled: 1}, totals)
}
