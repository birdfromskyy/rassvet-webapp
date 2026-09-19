package database

import "testing"

func TestInitialSocialServiceCategoryUsesCorrectCommunicativeCategory(t *testing.T) {
	name := "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания"
	want := communicativeSocialServicesCategory

	if got := initialSocialServiceCategory("Социально-педагогические услуги", name); got != want {
		t.Fatalf("initialSocialServiceCategory() = %q, want %q", got, want)
	}
	if !hasLegacyCommunicativeCategory("Социально-педагогические услуги", name) {
		t.Fatal("legacy category must be corrected for a communicative service")
	}
	if hasLegacyCommunicativeCategory("Социально-педагогические услуги", "Социально-педагогическая коррекция") {
		t.Fatal("regular social-pedagogical services must not be changed")
	}
}
