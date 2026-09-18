package database

import (
	"backend/internal/models"
	"backend/internal/utils"
	"strings"

	"gorm.io/gorm"
)

const communicativeSocialServicesCategory = "Услуги в целях повышения коммуникативного потенциала получателей социальных услуг, имеющих ограничения жизнедеятельности, в том числе детей инвалидов"

// ImportInitialSocialServices copies the supplied legal directory only when an
// administrator explicitly starts the import. Existing records are never
// overwritten, so later directory changes remain entirely under admin control.
func ImportInitialSocialServices(db *gorm.DB) (int, error) {
	created := 0
	for order, item := range initialSocialServices {
		row := models.SocialService{}
		result := db.Where("name = ?", item.name).First(&row)
		if result.Error == nil {
			changed := false
			if row.Code == "" || row.Category == "" {
				row.Code = initialSocialServiceCode(item.name)
				row.Category = initialSocialServiceCategory(item.category, item.name)
				changed = true
			}
			if hasLegacyCommunicativeCategory(row.Category, item.name) {
				row.Category = initialSocialServiceCategory(item.category, item.name)
				changed = true
			}
			if changed {
				if err := db.Save(&row).Error; err != nil {
					return created, err
				}
			}
			continue
		}
		if result.Error != gorm.ErrRecordNotFound {
			return created, result.Error
		}
		row = models.SocialService{Code: initialSocialServiceCode(item.name), Category: initialSocialServiceCategory(item.category, item.name), Name: item.name, StandardDurationMinutes: item.duration, Periodicity: utils.NormalizeSocialServicePeriodicity(item.periodicity), TariffKopecks: item.tariffKopecks, SortOrder: order, IsActive: true}
		if err := db.Create(&row).Error; err != nil {
			return created, err
		}
		created++
	}
	return created, nil
}

func initialSocialServiceCategory(category, name string) string {
	if isCommunicativeSocialService(name) {
		return communicativeSocialServicesCategory
	}
	return strings.TrimSpace(category)
}

// CorrectInitialSocialServiceCategories fixes only the known source typo for
// communicative services that were imported before the category was corrected.
func CorrectInitialSocialServiceCategories(db *gorm.DB) error {
	return db.Model(&models.SocialService{}).
		Where(`name LIKE ? OR name LIKE ? OR name LIKE ?`,
			"%Проведение социально-реабилитационных мероприятий%",
			"%навыкам поведения%",
			"%компьютерной грамотности%",
		).
		Where("category <> ?", communicativeSocialServicesCategory).
		Update("category", communicativeSocialServicesCategory).Error
}

// CorrectSocialServicePeriodicities removes source alternatives left in records
// imported before periodicities were normalized. It also recalculates the
// automatic monthly maximum for every existing student service.
func CorrectSocialServicePeriodicities(db *gorm.DB) error {
	var directory []models.SocialService
	if err := db.Find(&directory).Error; err != nil {
		return err
	}
	for _, service := range directory {
		periodicity := utils.NormalizeSocialServicePeriodicity(service.Periodicity)
		if periodicity == service.Periodicity {
			continue
		}
		if err := db.Model(&service).Update("periodicity", periodicity).Error; err != nil {
			return err
		}
	}

	var studentServices []models.StudentSocialService
	legacyQuery := db.Model(&models.StudentSocialService{})
	if db.Migrator().HasTable(&models.StudentServiceMonth{}) {
		legacyQuery = legacyQuery.Where("NOT EXISTS (SELECT 1 FROM student_service_months m WHERE m.student_id = student_social_services.student_id)")
	}
	if err := legacyQuery.Find(&studentServices).Error; err != nil {
		return err
	}
	for _, service := range studentServices {
		periodicity := utils.NormalizeSocialServicePeriodicity(service.Periodicity)
		maximum := utils.SocialServiceMaximumMonthlyCount(periodicity)
		if periodicity == service.Periodicity && maximum == service.MaximumMonthlyCount {
			continue
		}
		if err := db.Model(&service).Updates(map[string]interface{}{
			"periodicity":           periodicity,
			"maximum_monthly_count": maximum,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}

func isCommunicativeSocialService(name string) bool {
	return strings.Contains(name, "Проведение социально-реабилитационных мероприятий") ||
		strings.Contains(name, "навыкам поведения") ||
		strings.Contains(name, "компьютерной грамотности")
}

// hasLegacyCommunicativeCategory limits correction to source services affected
// by the typo; categories assigned by administrators to other services stay intact.
func hasLegacyCommunicativeCategory(category, name string) bool {
	if !isCommunicativeSocialService(name) {
		return false
	}
	normalized := strings.Join(strings.Fields(category), " ")
	return normalized == "Социально-педагогические услуги" ||
		normalized == "Услуги в целях повышения коммуникативного потенциала" ||
		normalized == "Услуги в целях повышения коммуникативного потенциала получателей социальных услуг, имеющих ограничения жизнедеятельности, в том числе детей-инвалидов"
}

func initialSocialServiceCode(name string) string {
	codes := []struct{ key, code string }{
		{"2054)", "008.02"}, {"1022)", "017.01"}, {"1027)", "017.06"}, {"1031)", "017.10"}, {"1033)", "017.12"}, {"1034)", "017.13"}, {"728)", "018"},
		{"176)", "003.01"}, {"673)", "006"}, {"178)", "005"}, {"1088)", "002.04"},
		{"1741)", "001.03"}, {"1740)", "001.02"}, {"1739)", "001.01"},
		{"1744)", "003.03"}, {"1743)", "003.02"}, {"1742)", "003.01"}, {"736)", "005"}, {"674)", "004"},
		{"1850)", "002.1.26"}, {"1849)", "002.1.25"}, {"1848)", "002.1.24"}, {"1847)", "002.1.23"}, {"1845)", "002.1.21"}, {"1844)", "002.1.20"}, {"1843)", "002.1.19"}, {"1842)", "002.1.18"}, {"1841)", "002.1.17"}, {"1840)", "002.1.16"}, {"1839)", "002.1.15"}, {"1838)", "002.1.14"}, {"1837)", "002.1.13"}, {"1836)", "002.1.12"}, {"1830)", "002.1.06"}, {"1828)", "002.1.04"}, {"1140)", "002.5"}, {"1138)", "002.3"}, {"1137)", "002.2"}, {"641)", "003"}, {"642)", "004"},
	}
	for _, item := range codes {
		if strings.Contains(name, item.key) {
			return item.code
		}
	}
	return "—"
}

type initialSocialService struct {
	category, name string
	duration       int
	periodicity    string
	tariffKopecks  int64
}

var initialSocialServices = []initialSocialService{
	{category: "Социально-бытовые услуги", name: "Обеспечение кратковременного присмотра за детьми-инвалидами, в том числе имеющими паллиативный статус (обслуживание на дому, 2054)", duration: 120, periodicity: "15 раз в месяц", tariffKopecks: 88642},
	{category: "Социально-бытовые услуги", name: "Предоставление (или помощь в осуществлении) гигиенических услуг лицам, не способным по состоянию здоровья самостоятельно осуществлять за собой уход - умывание, помощь в умывании (полустационарное обслуживание, 1022)", duration: 5, periodicity: "3 раза в день", tariffKopecks: 6245},
	{category: "Социально-бытовые услуги", name: "Предоставление (или помощь в осуществлении) гигиенических услуг лицам, не способным по состоянию здоровья самостоятельно осуществлять за собой уход - обтирание, обмывание, гигиенические ванны (полустационарное обслуживание, 1027)", duration: 15, periodicity: "1 раз в день", tariffKopecks: 18739},
	{category: "Социально-бытовые услуги", name: "Предоставление (или помощь в осуществлении) гигиенических услуг лицам, не способным по состоянию здоровья самостоятельно осуществлять за собой уход - помощь в одевании и переодевании (полустационарное обслуживание, 1031)", duration: 10, periodicity: "2 раза в день", tariffKopecks: 12492},
	{category: "Социально-бытовые услуги", name: "Предоставление (или помощь в осуществлении) гигиенических услуг лицам, не способным по состоянию здоровья самостоятельно осуществлять за собой уход - смена абсорбирующего белья, подгузников (полустационарное обслуживание, 1033)", duration: 10, periodicity: "1 раз в день", tariffKopecks: 12492},
	{category: "Социально-бытовые услуги", name: "Предоставление (или помощь в осуществлении) гигиенических услуг лицам, не способным по состоянию здоровья самостоятельно осуществлять за собой уход - помощь в пользовании туалетом или судном (сопровождение в туалет или высаживание на судно, вынос судна (полустационарное обслуживание, 1034)", duration: 10, periodicity: "3 раза в день", tariffKopecks: 12492},
	{category: "Социально-бытовые услуги", name: "Помощь в приеме пищи (кормление) (полустационарное обслуживание, 728)", duration: 20, periodicity: "1 в соответствии с ИППСУ ИЛИ 3 раза в день", tariffKopecks: 24197},
	{category: "Социально-медицинские  услуги", name: "Систематическое наблюдение за получателями социальных услуг в целях выявления отклонений в состоянии их здоровья (полустационарное обслуживание, 176)", duration: 15, periodicity: "1 раз в день", tariffKopecks: 20478},
	{category: "Социально-медицинские  услуги", name: "Проведений занятий по адаптивной физической культуре (группа до 5 человек) (полустационарное обслуживание, 673)", duration: 30, periodicity: "2 раза в неделю по медицинским показаниям", tariffKopecks: 20479},
	{category: "Социально-медицинские  услуги", name: "Проведение мероприятий, направленных на формирование здорового образа жизни (группа до 5 человек) (полустационарное обслуживание, 178)", duration: 40, periodicity: "2 раза в неделю", tariffKopecks: 10922},
	{category: "Социально-медицинские  услуги", name: "Проведение оздоровительных мероприятий - ручной и механический массаж (полустационарное обслуживание, 1088)", duration: 15, periodicity: "1 По назначению врача", tariffKopecks: 26731},
	{category: "Социально-психологические  услуги", name: "Психологическая коррекция (полустационарное обслуживание, 1741)", duration: 40, periodicity: "2 раза в неделю ИЛИ 2 раза в год (курс по 10 дней)", tariffKopecks: 47429},
	{category: "Социально-психологические  услуги", name: "Психодиагностика (полустационарное обслуживание, 1740)", duration: 30, periodicity: "6 раз в год  ИЛИ 4 раза в год", tariffKopecks: 35571},
	{category: "Социально-психологические  услуги", name: "Социально-психологическое консультирование (полустационарное обслуживание, 1739)", duration: 40, periodicity: "2 раза в месяц", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Социально-педагогическая коррекция (полустационарное обслуживание, 1744)", duration: 40, periodicity: "2 раза в неделю ИЛИ 1 раз в неделю", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Социально-педагогическая диагностика (полустационарное обслуживание, 1743)", duration: 30, periodicity: "1 раз в месяц", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Социально-педагогическое консультирование (полустационарное обслуживание, 1742)", duration: 40, periodicity: "2 раза в месяц", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Организация (или помощь в организации) досуга (праздники, экскурсии и другие культурные мероприятия) (группа до 5 человек) (полустационарное обслуживание, 736)", duration: 90, periodicity: "2 раза в неделю ИЛИ 1 раз в неделю", tariffKopecks: 21343},
	{category: "Социально-педагогические  услуги", name: "Формирование позитивных интересов (в том числе в сфере досуга) (группа до 5 человек) (полустационарное обслуживание, 674)", duration: 30, periodicity: "2 раза в неделю", tariffKopecks: 7114},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - Проведение оздоровительных мероприятий (полустационарное обслуживание, 1850)", duration: 15, periodicity: "2 раза в неделю", tariffKopecks: 17784},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - Проведение социокультурной реабилитации (организация досуга) (полустационарное обслуживание, 1849)", duration: 30, periodicity: "1 раз в неделю", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - Проведение социально-бытовой адаптации (обучение инвалида самообслуживанию) (полустационарное обслуживание, 1848)", duration: 30, periodicity: "2 раза в неделю", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - логопедическая помощь (полустационарное обслуживание, 1847)", duration: 30, periodicity: "2 раза в неделю", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - педагогическая коррекция (полустационарное обслуживание, 1845)", duration: 40, periodicity: "1 раз в неделю", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - социально-педагогическое консультирование (полустационарное обслуживание, 1844)", duration: 40, periodicity: "2 раза в месяц", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - социально-педагогическая диагностика (полустационарное обслуживание, 1843)", duration: 30, periodicity: "1 раз в месяц", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - психологическая поддержка (полустационарное обслуживание, 1842)", duration: 35, periodicity: "1 раз в месяц", tariffKopecks: 41499},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - социально-психологический патронаж (полустационарное обслуживание, 1841)", duration: 20, periodicity: "2 раза в месяц", tariffKopecks: 23714},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - социально-психологический тренинг (полустационарное обслуживание, 1840)", duration: 20, periodicity: "1 раз в месяц", tariffKopecks: 23714},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - психологическая профилактика (полустационарное обслуживание, 1839)", duration: 20, periodicity: "1 раз в месяц", tariffKopecks: 23714},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - психологическая коррекция (полустационарное обслуживание, 1838)", duration: 40, periodicity: "2 раза в год (курс по 10 дней)", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - психологическая реабилитационно-экспертная диагностика (полустационарное обслуживание, 1837)", duration: 30, periodicity: "4 раза в год", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - психологическое консультирование (полустационарное обслуживание, 1836)", duration: 40, periodicity: "2 раза в месяц", tariffKopecks: 47429},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - массаж  (полустационарное обслуживание, 1830)", duration: 30, periodicity: "10 раз за курс", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - проведение мероприятий ИПРА - трудотерапия (полустационарное обслуживание, 1828)", duration: 30, periodicity: "10 раз за курс", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - занятия в сенсорной комнате (полустационарное обслуживание, 1140)", duration: 30, periodicity: "3 раза в неделю ИЛИ 2 раза в неделю", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - разработка индивидуальных рекомендаций по дальнейшей жизнедеятельности в постреабилитационный период (полустационарное обслуживание, 1138)", duration: 30, periodicity: "1 раз в год ИЛИ 2 раза в год", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Проведение социально-реабилитационных мероприятий в сфере социального обслуживания - осуществление динамического контроля процесса реабилитации инвалидов (детей-инвалидов) (полустационарное обслуживание, 1137)", duration: 30, periodicity: "1 раз в неделю", tariffKopecks: 35571},
	{category: "Социально-педагогические  услуги", name: "Оказание помощи в обучении навыкам компьютерной грамотности (группа до 5 человек) (полустационарное обслуживание, 642)", duration: 30, periodicity: "2 раза в неделю", tariffKopecks: 17785},
	{category: "Социально-педагогические  услуги", name: "Обучение навыкам поведения в быту и общественных местах  (полустационарное обслуживание, 641)", duration: 20, periodicity: "1 раз в неделю", tariffKopecks: 23714},
}
