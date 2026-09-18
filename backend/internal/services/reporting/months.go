package reporting

import (
	"backend/internal/models"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
)

type Service struct{ DB *gorm.DB }
type ItemInput struct {
	SocialServiceID         uint    `json:"social_service_id"`
	Periodicity             *string `json:"periodicity"`
	MaximumMonthlyCount     *int    `json:"maximum_monthly_count"`
	ActualMonthlyCount      *int    `json:"actual_monthly_count"`
	StandardDurationMinutes *int    `json:"standard_duration_minutes"`
	TariffKopecks           *int64  `json:"tariff_kopecks"`
}
type MonthInput struct {
	Revision         int64       `json:"revision"`
	RepresentativeID *uint       `json:"representative_id"`
	Items            []ItemInput `json:"items"`
	RefreshSnapshots bool        `json:"refresh_snapshots"`
}
type CreateInput struct {
	MonthInput
	RequestID string `json:"request_id"`
	// create | copy_previous | migrate_legacy
	Mode                string       `json:"mode"`
	IncludeLegacyActual bool         `json:"include_legacy_actual"`
	LegacyMaximums      map[uint]int `json:"legacy_maximums"`
}

func loadMonth(tx *gorm.DB, child uint, month models.Date, lock string) (models.StudentServiceMonth, error) {
	var m models.StudentServiceMonth
	err := tx.Clauses(clause.Locking{Strength: lock}).Where("student_id = ? AND month = ?", child, month).First(&m).Error
	if err == nil {
		m.Items = []models.StudentServiceMonthItem{}
		err = tx.Where("month_id = ?", m.ID).Order("sort_order, id").Find(&m.Items).Error
	}
	return m, err
}
func (s Service) Get(child uint, month models.Date) (models.StudentServiceMonth, error) {
	var m models.StudentServiceMonth
	if err := ValidateMonth(month); err != nil {
		return m, err
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error { var err error; m, err = loadMonth(tx, child, month, "SHARE"); return err })
	return m, err
}

func person(st models.Student) models.ReportingPerson {
	return models.ReportingPerson{ID: st.ID, FullName: st.FullName, LastName: st.LastName, FirstName: st.FirstName, MiddleName: st.MiddleName, BirthDate: st.BirthDate, Revision: st.IdentityRevision}
}
func snapshot(tx *gorm.DB, child uint, month models.Date, repID *uint) (models.ServiceMonthSnapshot, error) {
	result := models.ServiceMonthSnapshot{SchemaVersion: 1}
	var st models.Student
	if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&st, child).Error; err != nil {
		return result, err
	}
	result.Student = person(st)
	if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&result.Contract, 1).Error; err != nil {
		return result, err
	}
	if repID != nil {
		var link models.StudentLegalRepresentative
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).Where("student_id = ? AND legal_representative_id = ?", child, *repID).First(&link).Error; err != nil {
			return result, invalid("Представитель не связан с ребёнком")
		}
		// A representative must be valid on the last day of the reporting month.
		d, _ := month.Time()
		end := models.Date(d.AddDate(0, 1, -1).Format("2006-01-02"))
		if (link.ValidFrom != nil && *link.ValidFrom > end) || (link.ValidUntil != nil && *link.ValidUntil < end) {
			return result, invalid("Представитель не действует на конец месяца")
		}
		var r models.LegalRepresentative
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&r, *repID).Error; err != nil {
			return result, err
		}
		if !r.IsActive {
			return result, invalid("Представитель неактивен")
		}
		result.Representative = &models.ReportingPerson{ID: r.ID, LastName: r.LastName, FirstName: r.FirstName, MiddleName: r.MiddleName, BirthDate: r.BirthDate, FullName: FullName(r.LastName, r.FirstName, r.MiddleName), Revision: r.Revision}
		result.Relationship = link.Relationship
		result.RelationshipRevision = link.Revision
		result.RelationshipValidFrom = link.ValidFrom
		result.RelationshipValidUntil = link.ValidUntil
	}
	return result, nil
}

func prepareItems(tx *gorm.DB, inputs []ItemInput, previous []models.StudentServiceMonthItem) ([]models.StudentServiceMonthItem, error) {
	if len(inputs) > 1000 {
		return nil, invalid("Не более 1000 услуг в месяце")
	}
	old := make(map[uint]models.StudentServiceMonthItem)
	for _, i := range previous {
		old[i.SocialServiceID] = i
	}
	seen := map[uint]bool{}
	result := make([]models.StudentServiceMonthItem, 0, len(inputs))
	for order, in := range inputs {
		if in.SocialServiceID == 0 || seen[in.SocialServiceID] {
			return nil, invalid("Услуги не должны повторяться")
		}
		seen[in.SocialServiceID] = true
		i, exists := old[in.SocialServiceID]
		if !exists {
			var d models.SocialService
			if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&d, in.SocialServiceID).Error; err != nil {
				return nil, err
			}
			if !d.IsActive {
				return nil, invalid("Нельзя добавить архивную услугу")
			}
			i = models.StudentServiceMonthItem{SocialServiceID: d.ID, Code: d.Code, Name: d.Name, Category: d.Category, Periodicity: d.Periodicity, StandardDurationMinutes: d.StandardDurationMinutes, TariffKopecks: d.TariffKopecks}
		}
		if in.Periodicity != nil {
			i.Periodicity = strings.TrimSpace(*in.Periodicity)
		}
		manual := in.MaximumMonthlyCount
		if manual == nil && exists && i.FrequencyUnit == "manual" && (in.Periodicity == nil || *in.Periodicity == old[in.SocialServiceID].Periodicity) {
			v := i.MaximumMonthlyCount
			manual = &v
		}
		var err error
		i.FrequencyCount, i.FrequencyUnit, i.MaximumMonthlyCount, err = Frequency(i.Periodicity, manual)
		if err != nil {
			return nil, err
		}
		if in.StandardDurationMinutes != nil {
			i.StandardDurationMinutes = *in.StandardDurationMinutes
		}
		if in.TariffKopecks != nil {
			i.TariffKopecks = *in.TariffKopecks
		}
		if i.StandardDurationMinutes < 1 || i.StandardDurationMinutes > 1440 || i.TariffKopecks < 0 || i.TariffKopecks > 100000000 {
			return nil, invalid("Недопустимая длительность или тариф")
		}
		if strings.TrimSpace(i.Code) == "" || strings.TrimSpace(i.Name) == "" || strings.TrimSpace(i.Category) == "" {
			return nil, invalid("У услуги должны быть код, наименование и категория")
		}
		i.ActualMonthlyCount = in.ActualMonthlyCount
		if i.ActualMonthlyCount != nil && (*i.ActualMonthlyCount < 0 || *i.ActualMonthlyCount > i.MaximumMonthlyCount) {
			return nil, invalid("Количество не может превышать максимум или быть отрицательным")
		}
		i.SortOrder = order
		result = append(result, i)
	}
	return result, nil
}

func record(tx *gorm.DB, m *models.StudentServiceMonth, action string, actor *uint) error {
	return tx.Create(&models.StudentServiceMonthRevision{MonthID: m.ID, Revision: m.Revision, Action: action, Data: *m, CreatedBy: actor}).Error
}
func writeItems(tx *gorm.DB, m *models.StudentServiceMonth) error {
	ids := make([]uint, 0, len(m.Items))
	for n := range m.Items {
		i := &m.Items[n]
		i.MonthID = m.ID
		if err := tx.Save(i).Error; err != nil {
			return err
		}
		ids = append(ids, i.ID)
	}
	q := tx.Where("month_id = ?", m.ID)
	if len(ids) > 0 {
		q = q.Where("id NOT IN ?", ids)
	}
	return q.Delete(&models.StudentServiceMonthItem{}).Error
}

func (s Service) Create(child uint, month models.Date, in CreateInput, actor *uint) (models.StudentServiceMonth, error) {
	var result models.StudentServiceMonth
	if err := ValidateMonth(month); err != nil {
		return result, err
	}
	if len(in.RequestID) < 8 || len(in.RequestID) > 128 {
		return result, invalid("request_id должен содержать 8–128 символов")
	}
	if in.Revision != 0 {
		return result, invalid("У нового месяца revision задаёт сервер")
	}
	if in.Mode == "" {
		in.Mode = "create"
	}
	if in.Mode != "create" && in.Mode != "copy_previous" && in.Mode != "migrate_legacy" {
		return result, invalid("Неизвестный способ создания")
	}
	if in.Mode != "create" && (in.Items != nil || in.RefreshSnapshots) {
		return result, invalid("Копирование/перенос не принимают новый список услуг")
	}
	if in.Mode != "migrate_legacy" && in.IncludeLegacyActual {
		return result, invalid("Подтверждение факта допустимо только при переносе")
	}
	if in.Mode != "migrate_legacy" && len(in.LegacyMaximums) > 0 {
		return result, invalid("legacy_maximums допустим только при переносе")
	}
	b, _ := json.Marshal(struct {
		Month models.Date
		Input CreateInput
	}{month, in})
	hash := fmt.Sprintf("%x", sha256.Sum256(b))
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var childRow models.Student
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&childRow, child).Error; err != nil {
			return err
		}
		var replay models.StudentServiceMonth
		err := tx.Where("student_id = ? AND creation_key = ?", child, in.RequestID).First(&replay).Error
		if err == nil {
			if replay.CreationHash != hash {
				return conflict("request_id уже использован для другого запроса")
			}
			var rev models.StudentServiceMonthRevision
			if err := tx.Where("month_id = ? AND revision = 1", replay.ID).First(&rev).Error; err != nil {
				return err
			}
			result = rev.Data
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		var count int64
		if err := tx.Model(&models.StudentServiceMonth{}).Where("student_id = ? AND month = ?", child, month).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return conflict("Целевой месяц уже существует")
		}
		var legacy []models.StudentSocialService
		if err := tx.Where("student_id = ?", child).Order("id").Find(&legacy).Error; err != nil {
			return err
		}
		var migrated int64
		if err := tx.Model(&models.SocialServiceLegacyMigration{}).Where("student_id = ?", child).Count(&migrated).Error; err != nil {
			return err
		}
		if len(legacy) > 0 && migrated == 0 && in.Mode != "migrate_legacy" {
			return conflict("Сначала явно перенесите старые услуги в выбранный месяц")
		}
		result = models.StudentServiceMonth{StudentID: child, Month: month, RepresentativeID: in.RepresentativeID, Revision: 1, Status: "draft", CreatedBy: actor, UpdatedBy: actor, CreationKey: in.RequestID, CreationHash: hash}
		var previous []models.StudentServiceMonthItem
		switch in.Mode {
		case "copy_previous":
			d, _ := month.Time()
			prev, err := loadMonth(tx, child, models.Date(d.AddDate(0, -1, 0).Format("2006-01-02")), "SHARE")
			if err != nil {
				return err
			}
			previous = prev.Items
			in.Items = make([]ItemInput, 0, len(previous))
			for n := range previous {
				i := &previous[n]
				i.ID = 0
				i.MonthID = 0
				i.ActualMonthlyCount = nil
				max := i.MaximumMonthlyCount
				in.Items = append(in.Items, ItemInput{SocialServiceID: i.SocialServiceID, MaximumMonthlyCount: &max})
			}
			if result.RepresentativeID == nil {
				result.RepresentativeID = prev.RepresentativeID
			}
		case "migrate_legacy":
			if migrated > 0 || len(legacy) == 0 {
				return conflict("Нет старого набора для переноса")
			}
			in.Items = make([]ItemInput, 0, len(legacy))
			known := map[uint]bool{}
			for n := range legacy {
				i := &legacy[n]
				known[i.SocialServiceID] = true
				var d models.SocialService
				if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&d, i.SocialServiceID).Error; err != nil {
					return err
				}
				previous = append(previous, models.StudentServiceMonthItem{SocialServiceID: d.ID, Code: d.Code, Name: d.Name, Category: d.Category, Periodicity: i.Periodicity, StandardDurationMinutes: i.StandardDurationMinutes, TariffKopecks: i.TariffKopecks})
				input := ItemInput{SocialServiceID: i.SocialServiceID}
				if max, ok := in.LegacyMaximums[i.SocialServiceID]; ok {
					input.MaximumMonthlyCount = &max
				}
				if in.IncludeLegacyActual {
					input.ActualMonthlyCount = &i.ActualMonthlyCount
				}
				in.Items = append(in.Items, input)
			}
			for id := range in.LegacyMaximums {
				if !known[id] {
					return invalid("Максимум указан для отсутствующей услуги")
				}
			}
		}
		var errSnapshot error
		result.Snapshot, errSnapshot = snapshot(tx, child, month, result.RepresentativeID)
		if errSnapshot != nil {
			return errSnapshot
		}
		items, err := prepareItems(tx, in.Items, previous)
		if err != nil {
			return err
		}
		result.Items = items
		if err := tx.Omit("Items").Create(&result).Error; err != nil {
			return err
		}
		if err := writeItems(tx, &result); err != nil {
			return err
		}
		if in.Mode == "migrate_legacy" {
			if err := tx.Create(&models.SocialServiceLegacyMigration{StudentID: child, MonthID: result.ID, IncludeActual: in.IncludeLegacyActual, CreatedBy: actor}).Error; err != nil {
				return err
			}
		}
		return record(tx, &result, in.Mode, actor)
	})
	return result, err
}

func sameID(a, b *uint) bool { return a == nil && b == nil || a != nil && b != nil && *a == *b }
func (s Service) Update(child uint, month models.Date, in MonthInput, actor *uint) (models.StudentServiceMonth, error) {
	var result models.StudentServiceMonth
	if err := ValidateMonth(month); err != nil {
		return result, err
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var st models.Student
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&st, child).Error; err != nil {
			return err
		}
		var err error
		result, err = loadMonth(tx, child, month, "UPDATE")
		if err != nil {
			return err
		}
		if err := CheckRevision(in.Revision, result.Revision); err != nil {
			return err
		}
		if result.Status != "draft" {
			return conflict("Сначала откройте новую редакцию завершённого месяца")
		}
		if in.Items == nil {
			return invalid("PUT требует полный список items")
		}
		items, err := prepareItems(tx, in.Items, result.Items)
		if err != nil {
			return err
		}
		result.Items = items
		if in.RefreshSnapshots || !sameID(in.RepresentativeID, result.RepresentativeID) {
			result.Snapshot, err = snapshot(tx, child, month, in.RepresentativeID)
			if err != nil {
				return err
			}
		}
		result.RepresentativeID = in.RepresentativeID
		result.Revision++
		result.UpdatedBy = actor
		if err := tx.Omit("Items").Save(&result).Error; err != nil {
			return err
		}
		if err := writeItems(tx, &result); err != nil {
			return err
		}
		return record(tx, &result, "update", actor)
	})
	return result, err
}

func ready(m models.StudentServiceMonth) error {
	p := m.Snapshot.Student
	if err := ValidatePerson(p.LastName, p.FirstName, p.MiddleName, p.BirthDate); err != nil {
		return err
	}
	if p.BirthDate == nil {
		return invalid("Укажите дату рождения ребёнка")
	}
	// Finalization fixes monthly facts, not an Act. The general report does not
	// require a representative/contract. Act-specific readiness is checked by
	// the future export workflow, including its local-only document fields.
	if len(m.Items) == 0 || Calculate(m.Items).Unfilled > 0 {
		return invalid("Заполните фактическое количество каждой услуги (0 допускается)")
	}
	return nil
}
func (s Service) Transition(child uint, month models.Date, revision int64, finalize bool, actor *uint) (models.StudentServiceMonth, error) {
	var result models.StudentServiceMonth
	if err := ValidateMonth(month); err != nil {
		return result, err
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = loadMonth(tx, child, month, "UPDATE")
		if err != nil {
			return err
		}
		if err := CheckRevision(revision, result.Revision); err != nil {
			return err
		}
		action, status, from := "reopen", "draft", "finalized"
		if finalize {
			action, status, from = "finalize", "finalized", "draft"
		}
		if result.Status != from {
			return conflict("Месяц уже находится в другом состоянии")
		}
		if finalize {
			if err := ready(result); err != nil {
				return err
			}
		}
		result.Status = status
		result.Revision++
		result.UpdatedBy = actor
		result.UpdatedAt = time.Now()
		if err := tx.Omit("Items").Save(&result).Error; err != nil {
			return err
		}
		return record(tx, &result, action, actor)
	})
	return result, err
}
