package handlers

import (
	"backend/internal/database"
	"backend/internal/models"
	"backend/internal/services/reporting"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func reportingFixture(t *testing.T, db *gorm.DB) (models.Student, models.SocialService, reporting.Service) {
	t.Helper()
	dob := models.Date("2016-02-29")
	st := models.Student{FullName: "Тестов Иван Длинноеотчество", LastName: "Тестов", FirstName: "Иван", MiddleName: "Длинноеотчество", BirthDate: &dob, FundingType: models.FundingTypeBudget}
	require.NoError(t, db.Create(&st).Error)
	svc := models.SocialService{Code: "T-001", Category: "Социально-бытовые услуги", Name: "Синтетическая услуга", StandardDurationMinutes: 30, Periodicity: "2 раза в неделю", TariffKopecks: 35571, IsActive: true}
	require.NoError(t, db.Create(&svc).Error)
	return st, svc, reporting.Service{DB: db}
}
func monthInput(service uint, count *int) reporting.CreateInput {
	return reporting.CreateInput{RequestID: uuid.NewString(), MonthInput: reporting.MonthInput{Items: []reporting.ItemInput{{SocialServiceID: service, ActualMonthlyCount: count}}}}
}
func requireConflict(t *testing.T, err error) {
	t.Helper()
	var e *reporting.Error
	require.ErrorAs(t, err, &e)
	require.Equal(t, 409, e.Status)
}

func TestReplaceDraftFromPreviousMonth(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	zero := 0
	_, err := s.Create(st.ID, "2026-12-01", monthInput(dir.ID, &zero), nil)
	require.NoError(t, err)
	target, err := s.Create(st.ID, "2027-01-01", monthInput(dir.ID, &zero), nil)
	require.NoError(t, err)
	require.NoError(t, e.db.Model(&dir).Updates(map[string]interface{}{"is_active": false, "name": "Новое имя", "tariff_kopecks": 1}).Error)
	copied, err := s.CopyPreviousIntoDraft(st.ID, "2027-01-01", target.Revision, nil)
	require.NoError(t, err)
	require.Equal(t, target.Revision+1, copied.Revision)
	require.Equal(t, target.Snapshot, copied.Snapshot)
	require.Nil(t, copied.Items[0].ActualMonthlyCount)
	require.Equal(t, int64(35571), copied.Items[0].TariffKopecks)
	require.Equal(t, "Синтетическая услуга", copied.Items[0].Name)
	_, err = s.CopyPreviousIntoDraft(st.ID, "2027-01-01", target.Revision, nil)
	requireConflict(t, err)
	var old models.StudentServiceMonthRevision
	require.NoError(t, e.db.Where("month_id = ? AND revision = 1", target.ID).First(&old).Error)
	require.Equal(t, &zero, old.Data.Items[0].ActualMonthlyCount)
	_, err = s.CopyPreviousIntoDraft(st.ID, "2026-12-01", 1, nil)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	unchanged, err := s.Get(st.ID, "2026-12-01")
	require.NoError(t, err)
	require.Equal(t, int64(1), unchanged.Revision)
	_, err = s.Transition(st.ID, "2026-12-01", 1, true, nil)
	require.NoError(t, err)
	_, err = s.CopyPreviousIntoDraft(st.ID, "2026-12-01", 2, nil)
	requireConflict(t, err)
}

func TestServiceMonthsIsolationSnapshotsAndCopy(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	three := 3
	m, err := s.Create(st.ID, "2026-12-01", monthInput(dir.ID, &three), nil)
	require.NoError(t, err)
	require.Equal(t, 8, m.Items[0].MaximumMonthlyCount)
	require.Equal(t, int64(106713), reporting.Calculate(m.Items).Kopecks)
	require.NoError(t, e.db.Model(&dir).Updates(map[string]interface{}{"tariff_kopecks": 999, "name": "Новое название", "is_active": false}).Error)
	require.NoError(t, e.db.Model(&st).Updates(map[string]interface{}{"is_active": false, "archived_at": time.Now()}).Error)
	copyIn := reporting.CreateInput{Mode: "copy_previous", RequestID: uuid.NewString()}
	copyMonth, err := s.Create(st.ID, "2027-01-01", copyIn, nil)
	require.NoError(t, err)
	require.Nil(t, copyMonth.Items[0].ActualMonthlyCount)
	require.Equal(t, int64(35571), copyMonth.Items[0].TariffKopecks)
	require.Equal(t, "Синтетическая услуга", copyMonth.Items[0].Name)
	require.NotEqual(t, m.Items[0].ID, copyMonth.Items[0].ID)
	replay, err := s.Create(st.ID, "2027-01-01", copyIn, nil)
	require.NoError(t, err)
	require.Equal(t, copyMonth.ID, replay.ID)
	copyIn.RequestID = uuid.NewString()
	_, err = s.Create(st.ID, "2027-01-01", copyIn, nil)
	requireConflict(t, err)
	zero := 0
	edited, err := s.Update(st.ID, "2027-01-01", reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{{SocialServiceID: dir.ID, ActualMonthlyCount: &zero}}}, nil)
	require.NoError(t, err)
	require.Equal(t, int64(2), edited.Revision)
	unchanged, err := s.Get(st.ID, "2026-12-01")
	require.NoError(t, err)
	require.Equal(t, three, *unchanged.Items[0].ActualMonthlyCount)
	_, err = s.Update(st.ID, "2027-01-01", reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{}}, nil)
	requireConflict(t, err)
	var revisions []models.StudentServiceMonthRevision
	require.NoError(t, e.db.Where("month_id = ?", edited.ID).Order("revision").Find(&revisions).Error)
	require.Len(t, revisions, 2)
	require.Nil(t, revisions[0].Data.Items[0].ActualMonthlyCount)
	// Failed SQL checks are isolated by savepoints, not allowed to abort the test fixture.
	require.Error(t, e.db.Transaction(func(tx *gorm.DB) error { return tx.Model(&revisions[0]).Update("action", "tampered").Error }))
	require.Error(t, e.db.Transaction(func(tx *gorm.DB) error { return tx.Delete(&revisions[0]).Error }))
}

func TestServiceMonthsFinalizationAndPeople(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	birth := models.Date("1988-03-01")
	parent := e.seedUser(t, "finalization-parent@test.invalid", "password123", "user", true)
	require.NoError(t, e.db.Create(&models.UserStudent{UserID: parent.ID, StudentID: st.ID}).Error)
	require.NoError(t, s.EnsureAccountRepresentatives(st.ID))
	var rep models.LegalRepresentative
	require.NoError(t, e.db.Where("user_id = ?", parent.ID).First(&rep).Error)
	rep, err := s.SaveRepresentative(rep.ID, reporting.RepresentativeInput{PersonInput: reporting.PersonInput{Revision: rep.Revision, LastName: "Тестова", FirstName: "Анна", BirthDate: &birth}, UserID: &parent.ID}, nil)
	require.NoError(t, err)
	contractDate := models.Date("2020-01-01")
	settings, err := s.UpdateSettings(reporting.SettingsInput{Revision: 1, ContractNumber: "TEST-1", ContractDate: &contractDate}, nil)
	require.NoError(t, err)
	in := monthInput(dir.ID, nil)
	in.RepresentativeID = &rep.ID
	m, err := s.Create(st.ID, "2026-09-01", in, nil)
	require.NoError(t, err)
	require.Equal(t, "TEST-1", m.Snapshot.Contract.ContractNumber)
	_, err = s.Transition(st.ID, m.Month, 1, true, nil)
	require.Error(t, err)
	_, err = s.UpdateSettings(reporting.SettingsInput{Revision: settings.Revision, ContractNumber: "TEST-2", ContractDate: &contractDate}, nil)
	require.NoError(t, err)
	_, err = s.UpdateStudentIdentity(st.ID, reporting.PersonInput{Revision: st.IdentityRevision, LastName: "Новое", FirstName: "Имя", BirthDate: st.BirthDate})
	require.NoError(t, err)
	zero := 0
	m, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 1, RepresentativeID: &rep.ID, Items: []reporting.ItemInput{{SocialServiceID: dir.ID, ActualMonthlyCount: &zero}}}, nil)
	require.NoError(t, err)
	require.Equal(t, "Тестов", m.Snapshot.Student.LastName)
	require.Equal(t, "TEST-1", m.Snapshot.Contract.ContractNumber)
	m, err = s.Transition(st.ID, m.Month, 2, true, nil)
	require.NoError(t, err)
	require.Equal(t, "finalized", m.Status)
	_, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 3, Items: []reporting.ItemInput{}}, nil)
	requireConflict(t, err)
	m, err = s.Transition(st.ID, m.Month, 3, false, nil)
	require.NoError(t, err)
	m, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 4, RepresentativeID: &rep.ID, RefreshSnapshots: true, Items: []reporting.ItemInput{{SocialServiceID: dir.ID, ActualMonthlyCount: &zero}}}, nil)
	require.NoError(t, err)
	require.Equal(t, "Новое", m.Snapshot.Student.LastName)
	require.Equal(t, "TEST-2", m.Snapshot.Contract.ContractNumber)
	var finalized models.StudentServiceMonthRevision
	require.NoError(t, e.db.Where("month_id = ? AND revision = 3", m.ID).First(&finalized).Error)
	require.Equal(t, "Тестов", finalized.Data.Snapshot.Student.LastName)
	other, _, _ := reportingFixture(t, e.db)
	bad := monthInput(dir.ID, nil)
	bad.RepresentativeID = &rep.ID
	_, err = s.Create(other.ID, m.Month, bad, nil)
	require.ErrorContains(t, err, "не связан")
}

func TestServiceMonthsExplicitLegacyCutover(t *testing.T) {
	for _, include := range []bool{false, true} {
		t.Run(fmt.Sprint(include), func(t *testing.T) {
			e := newTestEnv(t)
			st, dir, s := reportingFixture(t, e.db)
			old := models.StudentSocialService{StudentID: st.ID, SocialServiceID: dir.ID, Periodicity: "10 раз за курс", MaximumMonthlyCount: 10, ActualMonthlyCount: 0, StandardDurationMinutes: 25, TariffKopecks: 12345}
			require.NoError(t, e.db.Create(&old).Error)
			_, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, nil), nil)
			requireConflict(t, err)
			in := reporting.CreateInput{Mode: "migrate_legacy", RequestID: uuid.NewString(), IncludeLegacyActual: include}
			_, err = s.Create(st.ID, "2026-09-01", in, nil)
			require.ErrorContains(t, err, "максимум")
			in.LegacyMaximums = map[uint]int{dir.ID: 10}
			m, err := s.Create(st.ID, "2026-09-01", in, nil)
			require.NoError(t, err)
			if include {
				require.NotNil(t, m.Items[0].ActualMonthlyCount)
				require.Zero(t, *m.Items[0].ActualMonthlyCount)
			} else {
				require.Nil(t, m.Items[0].ActualMonthlyCount)
			}
			require.Equal(t, int64(12345), m.Items[0].TariffKopecks)
			var count int64
			require.NoError(t, e.db.Model(&models.StudentServiceMonth{}).Where("student_id = ?", st.ID).Count(&count).Error)
			require.Equal(t, int64(1), count)
			require.NoError(t, e.db.First(&old, old.ID).Error)
			// Monthly records are retained as history, but the current IPPSU
			// assignment remains editable after the workflow change.
			require.NoError(t, e.db.Transaction(func(tx *gorm.DB) error { return tx.Model(&old).Update("actual_monthly_count", 1).Error }))
			require.NoError(t, database.CorrectSocialServicePeriodicities(e.db))
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(st.ID)}}
			NewSocialServiceHandler(e.db).GetForStudent(c)
			require.Equal(t, http.StatusOK, w.Code)
		})
	}
}

func TestReportingConstraintsAndAtomicRollback(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	nine := 9
	_, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, &nine), nil)
	require.Error(t, err)
	var count int64
	require.NoError(t, e.db.Model(&models.StudentServiceMonth{}).Count(&count).Error)
	require.Zero(t, count)
	m, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, nil), nil)
	require.NoError(t, err)
	for _, sql := range []string{
		"UPDATE student_service_months SET month = '2026-09-02' WHERE id = ?",
		"UPDATE student_service_month_items SET actual_monthly_count = 9 WHERE month_id = ?",
		"UPDATE student_service_month_items SET frequency_count = NULL WHERE month_id = ?",
		"UPDATE student_service_month_items SET tariff_kopecks = -1 WHERE month_id = ?",
		"UPDATE student_service_month_items SET maximum_monthly_count = 99 WHERE month_id = ?",
		"UPDATE student_service_months SET representative_id = 999999999 WHERE id = ?",
	} {
		require.Error(t, e.db.Transaction(func(tx *gorm.DB) error { return tx.Exec(sql, m.ID).Error }), sql)
	}
	_, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{{SocialServiceID: dir.ID}, {SocialServiceID: dir.ID}}}, nil)
	require.Error(t, err)
	current, err := s.Get(st.ID, m.Month)
	require.NoError(t, err)
	require.Equal(t, int64(1), current.Revision)
	require.NoError(t, database.MigrateReporting(e.db))
	require.NoError(t, database.MigrateReporting(e.db))
	// A used service is archived, including if it only survives in history.
	_, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{}}, nil)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprint(dir.ID)}}
	NewSocialServiceHandler(e.db).Delete(c)
	c.Writer.WriteHeaderNow()
	require.Equal(t, 204, w.Code)
	require.NoError(t, e.db.First(&dir, dir.ID).Error)
	require.False(t, dir.IsActive)
}

func TestReportingAPIAuthAndValidation(t *testing.T) {
	e := newTestEnv(t)
	st, dir, _ := reportingFixture(t, e.db)
	path := fmt.Sprintf("/api/admin/students/%d/service-months/2026-09-01", st.ID)
	require.Equal(t, 401, e.do("GET", path, "", nil).Code)
	for _, role := range []string{"user", "teacher", "admin", "superadmin"} {
		t.Run(role, func(t *testing.T) {
			u := e.seedUser(t, role+"-report@test.invalid", "password123", role, true)
			cookies := e.login(t, u.Email, "password123")
			w := e.do("GET", path, "", cookies)
			if role == "user" || role == "teacher" {
				require.Equal(t, 403, w.Code)
				return
			}
			if role == "admin" {
				require.Equal(t, 404, w.Code)
			} else {
				require.Equal(t, 200, w.Code)
			}
			w = e.do("POST", path, `{"request_id":"test-request","passport_number":"not-allowed"}`, cookies)
			require.Equal(t, 400, w.Code)
			body, _ := json.Marshal(monthInput(dir.ID, nil))
			w = e.do("POST", path, string(body), cookies)
			if role == "admin" {
				require.Equal(t, 200, w.Code, w.Body.String())
				require.Contains(t, w.Body.String(), `"actual_monthly_count":null`)
				var response struct {
					Month models.StudentServiceMonth `json:"month"`
				}
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
				require.NotNil(t, response.Month.CreatedBy)
				require.Equal(t, u.ID, *response.Month.CreatedBy)
			} else {
				require.Equal(t, 409, w.Code)
			}
			w = e.do("PUT", path, `{"items":[],"representative_id":null}`, cookies)
			require.Equal(t, 428, w.Code, w.Body.String())
			w = e.do("GET", path+"/revisions", "", cookies)
			require.Equal(t, 200, w.Code)
			require.Contains(t, w.Body.String(), `"created_by":`)
		})
	}
}

// Separate schema and connection pool permit real concurrent transactions.
// The only schema removed is the random one created by this test in *_test.
func isolatedReportingDB(t *testing.T, beforeMigration ...func(*gorm.DB)) *gorm.DB {
	t.Helper()
	schema := "phase1_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	require.NoError(t, baseDB.Exec("CREATE SCHEMA "+schema).Error)
	t.Cleanup(func() { require.NoError(t, baseDB.Exec("DROP SCHEMA "+schema+" CASCADE").Error) })
	for _, table := range []string{"users", "students", "social_services", "student_social_services"} {
		require.NoError(t, baseDB.Exec("CREATE TABLE "+schema+"."+table+" (LIKE public."+table+" INCLUDING DEFAULTS INCLUDING INDEXES)").Error)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable search_path=%s", getEnv("TEST_DB_HOST", "localhost"), getEnv("TEST_DB_PORT", "5433"), getEnv("DB_USER", "postgres"), os.Getenv("DB_PASSWORD"), getEnv("TEST_DB_NAME", "reviews_test"), schema)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	pool, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, pool.Close()) })
	for _, before := range beforeMigration {
		before(db)
	}
	require.NoError(t, database.MigrateReporting(db))
	return db
}

func TestReportingConcurrentRevisionConflict(t *testing.T) {
	db := isolatedReportingDB(t)
	st, dir, s := reportingFixture(t, db)
	_, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, nil), nil)
	require.NoError(t, err)
	start := make(chan struct{})
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for n := 0; n < 2; n++ {
		wg.Add(1)
		go func(count int) {
			defer wg.Done()
			<-start
			_, err := s.Update(st.ID, "2026-09-01", reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{{SocialServiceID: dir.ID, ActualMonthlyCount: &count}}}, nil)
			results <- err
		}(n)
	}
	close(start)
	wg.Wait()
	close(results)
	success, conflicts := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else {
			requireConflict(t, err)
			conflicts++
		}
	}
	require.Equal(t, 1, success)
	require.Equal(t, 1, conflicts)
	m, err := s.Get(st.ID, "2026-09-01")
	require.NoError(t, err)
	require.Equal(t, int64(2), m.Revision)
}

func TestReportingMigrationPreservesLegacyWithoutInventingHistory(t *testing.T) {
	var old models.StudentSocialService
	var childID uint
	db := isolatedReportingDB(t, func(db *gorm.DB) {
		require.NoError(t, db.Exec(`ALTER TABLE students DROP COLUMN last_name, DROP COLUMN first_name, DROP COLUMN middle_name, DROP COLUMN birth_date, DROP COLUMN identity_revision`).Error)
		require.NoError(t, db.Raw(`INSERT INTO students(full_name,funding_type,is_active,allow_schedule_windows) VALUES ('Синтетическое ФИО без разбора','budget',true,false) RETURNING id`).Scan(&childID).Error)
		dir := models.SocialService{Code: "TEST-MIGRATE", Category: "Тестовая категория", Name: "Услуга", Periodicity: "2 раза в неделю", StandardDurationMinutes: 20, TariffKopecks: 100}
		require.NoError(t, db.Create(&dir).Error)
		old = models.StudentSocialService{StudentID: childID, SocialServiceID: dir.ID, Periodicity: dir.Periodicity, MaximumMonthlyCount: 8, ActualMonthlyCount: 2, StandardDurationMinutes: 20, TariffKopecks: 100}
		require.NoError(t, db.Create(&old).Error)
	})
	var st models.Student
	require.NoError(t, db.First(&st, childID).Error)
	require.Equal(t, "Синтетическое ФИО без разбора", st.FullName)
	require.Equal(t, "Синтетическое", st.LastName)
	require.Equal(t, "ФИО", st.FirstName)
	require.Equal(t, "без разбора", st.MiddleName)
	require.Nil(t, st.BirthDate)
	var count int64
	require.NoError(t, db.Model(&models.StudentServiceMonth{}).Count(&count).Error)
	require.Zero(t, count)
	var after models.StudentSocialService
	require.NoError(t, db.First(&after, old.ID).Error)
	require.Equal(t, old.ActualMonthlyCount, after.ActualMonthlyCount)
	require.NoError(t, database.MigrateReporting(db))
	// An edited, already-applied migration is rejected, not silently accepted.
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("UPDATE reporting_schema_migrations SET checksum = 'changed'").Error; err != nil {
			return err
		}
		return database.MigrateReporting(tx)
	})
	require.ErrorContains(t, err, "checksum mismatch")
	require.NoError(t, database.MigrateReporting(db))
}

func TestReportingStudentIdentityCompatibility(t *testing.T) {
	e := newTestEnv(t)
	u := e.seedUser(t, "identity@test.invalid", "password123", "admin", true)
	cookies := e.login(t, u.Email, "password123")
	w := e.do("POST", "/api/admin/students", `{"last_name":"Тестов","first_name":"Иван","birth_date":"2016-02-29"}`, cookies)
	require.Equal(t, 201, w.Code, w.Body.String())
	var response struct {
		Student models.Student `json:"student"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	st := response.Student
	require.Equal(t, "Тестов Иван", st.FullName)
	require.Equal(t, models.Date("2016-02-29"), *st.BirthDate)
	path := fmt.Sprintf("/api/admin/students/%d", st.ID)
	w = e.do("PUT", path, `{"full_name":"Тестов Иван","is_active":false}`, cookies)
	require.Equal(t, 200, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Equal(t, "Тестов", response.Student.LastName)
	require.Equal(t, int64(1), response.Student.IdentityRevision)
	w = e.do("PUT", path, `{"full_name":"Новая строка ФИО"}`, cookies)
	require.Equal(t, 200, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Equal(t, "Новая", response.Student.LastName)
	require.Equal(t, "строка", response.Student.FirstName)
	require.Equal(t, "ФИО", response.Student.MiddleName)
	require.Equal(t, int64(2), response.Student.IdentityRevision)
	require.Equal(t, st.BirthDate, response.Student.BirthDate)
	w = e.do("PUT", path+"/identity", `{"revision":1,"last_name":"Тестов","first_name":"Иван"}`, cookies)
	require.Equal(t, 409, w.Code)
	w = e.do("PUT", path+"/identity", `{"revision":2,"last_name":"Тестов","first_name":"Иван","birth_date":"2016-02-29"}`, cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	w = e.do("PATCH", path+"/deactivate", "", cookies)
	require.Equal(t, 200, w.Code)
	w = e.do("GET", path, "", cookies)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Equal(t, "Тестов", response.Student.LastName)
	w = e.do("POST", "/api/admin/students", `{"full_name":"Старый формат"}`, cookies)
	require.Equal(t, 201, w.Code)
	w = e.do("POST", "/api/admin/students", `{"last_name":"Тестов","first_name":"Иван","birth_date":"2016-02-30"}`, cookies)
	require.Equal(t, 400, w.Code)
}

func TestReportingGeneralFactsDoNotRequireActOnlyFields(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	zero := 0
	m, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, &zero), nil)
	require.NoError(t, err)
	require.Nil(t, m.RepresentativeID)
	require.Empty(t, m.Snapshot.Contract.ContractNumber)
	_, err = s.Transition(st.ID, m.Month, m.Revision, true, nil)
	require.NoError(t, err)
}

func TestReportingRollbackAfterPartialWrite(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	m, err := s.Create(st.ID, "2026-09-01", monthInput(dir.ID, nil), nil)
	require.NoError(t, err)
	require.NoError(t, e.db.Exec(`CREATE FUNCTION phase1_reject_item_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END; $$;
 CREATE TRIGGER phase1_item_failure BEFORE UPDATE ON student_service_month_items FOR EACH ROW EXECUTE FUNCTION phase1_reject_item_for_test();`).Error)
	one := 1
	_, err = s.Update(st.ID, m.Month, reporting.MonthInput{Revision: 1, Items: []reporting.ItemInput{{SocialServiceID: dir.ID, ActualMonthlyCount: &one}}}, nil)
	require.Error(t, err)
	m, err = s.Get(st.ID, m.Month)
	require.NoError(t, err)
	require.Equal(t, int64(1), m.Revision)
	require.Nil(t, m.Items[0].ActualMonthlyCount)
	var count int64
	require.NoError(t, e.db.Model(&models.StudentServiceMonthRevision{}).Where("month_id = ?", m.ID).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestReportingRepresentativeValidityAndAccountDeletion(t *testing.T) {
	e := newTestEnv(t)
	st, dir, s := reportingFixture(t, e.db)
	u := e.seedUser(t, "representative@test.invalid", "password123", "user", true)
	require.NoError(t, e.db.Create(&models.UserStudent{UserID: u.ID, StudentID: st.ID}).Error)
	in := reporting.RepresentativeInput{PersonInput: reporting.PersonInput{LastName: "Тестова", FirstName: "Анна"}, UserID: &u.ID}
	r, err := s.SaveRepresentative(0, in, nil)
	require.NoError(t, err)
	until := models.Date("2026-08-31")
	link, err := s.SaveLink(st.ID, r.ID, reporting.LinkInput{Relationship: "мать", ValidUntil: &until}, nil)
	require.NoError(t, err)
	mInput := monthInput(dir.ID, nil)
	mInput.RepresentativeID = &r.ID
	_, err = s.Create(st.ID, "2026-09-01", mInput, nil)
	require.ErrorContains(t, err, "не действует")
	_, err = s.SaveLink(st.ID, r.ID, reporting.LinkInput{Relationship: "мать", Revision: link.Revision}, nil)
	require.NoError(t, err)
	_, err = s.SaveLink(st.ID, r.ID, reporting.LinkInput{Relationship: "опекун", Revision: link.Revision}, nil)
	requireConflict(t, err)
	in.Revision = r.Revision
	in.FirstName = "Анна-Мария"
	r, err = s.SaveRepresentative(r.ID, in, nil)
	require.NoError(t, err)
	_, err = s.SaveRepresentative(r.ID, in, nil)
	requireConflict(t, err)
	_, err = s.Create(st.ID, "2026-09-01", mInput, nil)
	require.NoError(t, err)
	require.NoError(t, e.db.Where("user_id = ? AND student_id = ?", u.ID, st.ID).Delete(&models.UserStudent{}).Error)
	require.NoError(t, e.db.Unscoped().Delete(u).Error)
	var reread models.LegalRepresentative
	require.NoError(t, e.db.First(&reread, r.ID).Error)
	require.Nil(t, reread.UserID)
	require.Error(t, e.db.Transaction(func(tx *gorm.DB) error { return tx.Delete(&reread).Error }))
	var typeName string
	require.NoError(t, e.db.Raw("SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'legal_representatives' AND column_name = 'birth_date'").Scan(&typeName).Error)
	require.Equal(t, "date", typeName)
}

func TestReportingUsesUserStudentAsOnlyRepresentativeLink(t *testing.T) {
	e := newTestEnv(t)
	student, _, _ := reportingFixture(t, e.db)
	parent := e.seedUser(t, "canonical-parent@test.invalid", "password123", "user", true)
	require.NoError(t, e.db.Create(&models.UserStudent{UserID: parent.ID, StudentID: student.ID}).Error)
	admin := e.seedUser(t, "canonical-parent-admin@test.invalid", "password123", "admin", true)
	cookies := e.login(t, admin.Email, "password123")

	w := e.do("GET", fmt.Sprintf("/api/admin/students/%d/legal-representatives", student.ID), "", cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	var rep models.LegalRepresentative
	require.NoError(t, e.db.Where("user_id = ?", parent.ID).First(&rep).Error)
	require.Contains(t, w.Body.String(), fmt.Sprintf(`"legal_representative_id":%d`, rep.ID))

	// An unrelated reporting row cannot be exposed as a second, independent
	// parent-child link.
	other := models.LegalRepresentative{LastName: "Посторонняя", FirstName: "Запись", IsActive: true, Revision: 1}
	require.NoError(t, e.db.Create(&other).Error)
	require.NoError(t, e.db.Create(&models.StudentLegalRepresentative{StudentID: student.ID, LegalRepresentativeID: other.ID, Relationship: "старые данные", Revision: 1}).Error)
	w = e.do("GET", fmt.Sprintf("/api/admin/students/%d/legal-representatives", student.ID), "", cookies)
	require.Equal(t, 200, w.Code)
	require.NotContains(t, w.Body.String(), fmt.Sprintf(`"legal_representative_id":%d`, other.ID))

	birth := "1980-01-02"
	w = e.do("PUT", fmt.Sprintf("/api/admin/legal-representatives/%d", rep.ID), fmt.Sprintf(`{"revision":%d,"last_name":"Новая","first_name":"Фамилия","middle_name":"","birth_date":"%s","user_id":%d,"is_active":true}`, rep.Revision, birth, parent.ID), cookies)
	require.Equal(t, 200, w.Code, w.Body.String())
	require.NoError(t, e.db.First(&parent, parent.ID).Error)
	require.Equal(t, "Новая", parent.LastName)
	require.Equal(t, "Фамилия", parent.FirstName)
}
