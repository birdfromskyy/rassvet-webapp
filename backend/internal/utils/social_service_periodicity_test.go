package utils

import "testing"

func TestNormalizeSocialServicePeriodicity(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"2 раза в неделю ИЛИ 1 раз в неделю", "2 раза в неделю"},
		{"1 в соответствии с ИППСУ ИЛИ 3 раза в день", "3 раза в день"},
		{"2 раза в месяц", "2 раза в месяц"},
	}
	for _, test := range tests {
		if got := NormalizeSocialServicePeriodicity(test.input); got != test.want {
			t.Errorf("NormalizeSocialServicePeriodicity(%q) = %q, want %q", test.input, got, test.want)
		}
	}
}

func TestSocialServiceMaximumMonthlyCount(t *testing.T) {
	tests := []struct {
		periodicity string
		want        int
	}{
		{"2 раза в день", 62},
		{"2 раза в неделю", 8},
		{"4 раза в месяц", 4},
		{"1 в соответствии с ИППСУ ИЛИ 3 раза в день", 93},
		{"по назначению врача", 0},
	}
	for _, test := range tests {
		if got := SocialServiceMaximumMonthlyCount(test.periodicity); got != test.want {
			t.Errorf("SocialServiceMaximumMonthlyCount(%q) = %d, want %d", test.periodicity, got, test.want)
		}
	}
}
