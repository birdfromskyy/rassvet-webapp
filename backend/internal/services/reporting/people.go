package reporting

import (
	"backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
	"unicode/utf8"
)

type PersonInput struct {
	Revision   int64        `json:"revision"`
	LastName   string       `json:"last_name"`
	FirstName  string       `json:"first_name"`
	MiddleName string       `json:"middle_name"`
	BirthDate  *models.Date `json:"birth_date"`
}

func (p *PersonInput) normalize() error {
	p.LastName = strings.TrimSpace(p.LastName)
	p.FirstName = strings.TrimSpace(p.FirstName)
	p.MiddleName = strings.TrimSpace(p.MiddleName)
	return ValidatePerson(p.LastName, p.FirstName, p.MiddleName, p.BirthDate)
}
func (s Service) UpdateStudentIdentity(id uint, in PersonInput) (models.Student, error) {
	var st models.Student
	if err := in.normalize(); err != nil {
		return st, err
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&st, id).Error; err != nil {
			return err
		}
		if err := CheckRevision(in.Revision, st.IdentityRevision); err != nil {
			return err
		}
		st.LastName = in.LastName
		st.FirstName = in.FirstName
		st.MiddleName = in.MiddleName
		st.BirthDate = in.BirthDate
		st.FullName = FullName(in.LastName, in.FirstName, in.MiddleName)
		st.IdentityRevision++
		return tx.Model(&st).Select("LastName", "FirstName", "MiddleName", "BirthDate", "FullName", "IdentityRevision", "UpdatedAt").Updates(&st).Error
	})
	return st, err
}

type RepresentativeInput struct {
	PersonInput
	UserID   *uint `json:"user_id"`
	IsActive *bool `json:"is_active"`
}

func (s Service) SaveRepresentative(id uint, in RepresentativeInput, actor *uint) (models.LegalRepresentative, error) {
	var r models.LegalRepresentative
	if err := in.normalize(); err != nil {
		return r, err
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if id != 0 {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, id).Error; err != nil {
				return err
			}
			if err := CheckRevision(in.Revision, r.Revision); err != nil {
				return err
			}
		} else {
			r.IsActive = true
			r.CreatedBy = actor
		}
		if in.UserID != nil {
			var count int64
			if err := tx.Model(&models.User{}).Where("id = ?", *in.UserID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return invalid("Учётная запись не найдена")
			}
		}
		r.LastName = in.LastName
		r.FirstName = in.FirstName
		r.MiddleName = in.MiddleName
		r.BirthDate = in.BirthDate
		r.UserID = in.UserID
		r.UpdatedBy = actor
		r.Revision++
		if in.IsActive != nil {
			r.IsActive = *in.IsActive
		}
		return tx.Save(&r).Error
	})
	return r, err
}

type LinkInput struct {
	Revision     int64        `json:"revision"`
	Relationship string       `json:"relationship"`
	ValidFrom    *models.Date `json:"valid_from"`
	ValidUntil   *models.Date `json:"valid_until"`
}

func (s Service) SaveLink(child, rep uint, in LinkInput, actor *uint) (models.StudentLegalRepresentative, error) {
	var link models.StudentLegalRepresentative
	in.Relationship = strings.TrimSpace(in.Relationship)
	if in.Relationship == "" || utf8.RuneCountInString(in.Relationship) > 80 {
		return link, invalid("Укажите отношение представителя к ребёнку")
	}
	if in.ValidFrom != nil && in.ValidUntil != nil && *in.ValidFrom > *in.ValidUntil {
		return link, invalid("Конец полномочий раньше начала")
	}
	for _, d := range []*models.Date{in.ValidFrom, in.ValidUntil} {
		if d != nil {
			if _, err := d.Time(); err != nil {
				return link, invalid("Некорректная дата полномочий")
			}
		}
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var st models.Student
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&st, child).Error; err != nil {
			return err
		}
		var r models.LegalRepresentative
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&r, rep).Error; err != nil {
			return err
		}
		err := tx.Where("student_id = ? AND legal_representative_id = ?", child, rep).First(&link).Error
		if err == gorm.ErrRecordNotFound {
			if in.Revision != 0 {
				return conflict("Связь ещё не создана")
			}
			link.StudentID = child
			link.LegalRepresentativeID = rep
			link.CreatedBy = actor
		} else if err != nil {
			return err
		} else if err := CheckRevision(in.Revision, link.Revision); err != nil {
			return err
		}
		link.Relationship = in.Relationship
		link.ValidFrom = in.ValidFrom
		link.ValidUntil = in.ValidUntil
		link.Revision++
		link.UpdatedBy = actor
		return tx.Save(&link).Error
	})
	return link, err
}

type SettingsInput struct {
	Revision       int64        `json:"revision"`
	ContractNumber string       `json:"contract_number"`
	ContractDate   *models.Date `json:"contract_date"`
}

func (s Service) UpdateSettings(in SettingsInput, actor *uint) (models.SocialServiceReportSettings, error) {
	var result models.SocialServiceReportSettings
	in.ContractNumber = strings.TrimSpace(in.ContractNumber)
	if in.ContractNumber == "" || utf8.RuneCountInString(in.ContractNumber) > 100 || in.ContractDate == nil {
		return result, invalid("Необходимы номер и дата договора")
	}
	if _, err := in.ContractDate.Time(); err != nil {
		return result, invalid("Некорректная дата договора")
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&result, 1).Error; err != nil {
			return err
		}
		if err := CheckRevision(in.Revision, result.Revision); err != nil {
			return err
		}
		result.ContractNumber = in.ContractNumber
		result.ContractDate = in.ContractDate
		result.Revision++
		result.UpdatedBy = actor
		result.UpdatedAt = time.Now()
		return tx.Save(&result).Error
	})
	return result, err
}
