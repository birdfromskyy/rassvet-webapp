package reporting

import (
	"backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CopyPreviousIntoDraft replaces assignments only after an explicit, revision-
// checked request. Historical snapshots (including archived services) survive;
// facts never carry over. People/contract snapshots of the target stay intact.
func (s Service) CopyPreviousIntoDraft(child uint, month models.Date, revision int64, actor *uint) (models.StudentServiceMonth, error) {
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
		if err := CheckRevision(revision, result.Revision); err != nil {
			return err
		}
		if result.Status != "draft" {
			return conflict("Сначала откройте месяц для изменений")
		}
		d, _ := month.Time()
		previous, err := loadMonth(tx, child, models.Date(d.AddDate(0, -1, 0).Format("2006-01-02")), "SHARE")
		if err != nil {
			return err
		}
		if err := tx.Where("month_id = ?", result.ID).Delete(&models.StudentServiceMonthItem{}).Error; err != nil {
			return err
		}
		result.Items = previous.Items
		for n := range result.Items {
			result.Items[n].ID = 0
			result.Items[n].MonthID = result.ID
			result.Items[n].ActualMonthlyCount = nil
		}
		result.Revision++
		result.UpdatedBy = actor
		if err := tx.Omit("Items").Save(&result).Error; err != nil {
			return err
		}
		if err := writeItems(tx, &result); err != nil {
			return err
		}
		return record(tx, &result, "replace_from_previous", actor)
	})
	return result, err
}
