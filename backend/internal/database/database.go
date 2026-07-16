package database

import (
	"backend/internal/config"
	"backend/internal/models"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Initialize(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	return db, nil
}

func Migrate(db *gorm.DB) {
	// Make previously NOT NULL columns nullable before AutoMigrate
	db.Exec("ALTER TABLE schedule_slots ALTER COLUMN assignment_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_slots ALTER COLUMN student_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_slots ALTER COLUMN subject_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_slots ALTER COLUMN room_id DROP NOT NULL")
	db.Exec("ALTER TABLE group_lessons ALTER COLUMN subject_id DROP NOT NULL")
	db.Exec("ALTER TABLE students ALTER COLUMN funding_type DROP NOT NULL")
	db.Exec("ALTER TABLE students ALTER COLUMN funding_type SET DEFAULT 'budget'")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN assignment_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN student_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN teacher_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN subject_id DROP NOT NULL")

	err := db.AutoMigrate(
		// Auth models
		&models.User{},
		&models.Review{},

		// Schedule module models
		&models.Subject{},
		&models.Teacher{},
		&models.TeacherUserLink{},
		&models.TeacherSubject{},
		&models.TeacherRoom{},
		&models.Room{},
		&models.RoomSubject{},
		&models.Student{},
		&models.StudentAvailability{},
		&models.TeacherAvailability{},
		&models.Assignment{},
		&models.GroupLesson{},
		&models.GroupLessonEnrollment{},
		&models.Schedule{},
		&models.ScheduleSlot{},
		&models.ScheduleGenerationIssue{},
		&models.ScheduleSlotBackup{},
		&models.GroupLessonAttendance{},
		&models.UserStudent{},

		// Document submissions (parent profiles + child docs)
		&models.ParentProfile{},
		&models.ChildDocSubmission{},

		// CMS models (Employee removed — teachers table is used instead)
		&models.CmsFile{},
		&models.HistoryEvent{},
		&models.Article{},
		&models.ArticleBlock{},
		&models.ServiceItem{},
		&models.FinZone{},
		&models.SiteSetting{},

		// In-app notifications
		&models.Notification{},

		// Consultation requests (from public form)
		&models.ConsultationRequest{},

		// CMS: achievements and awards
		&models.Achievement{},
		&models.Award{},

		// Questionnaire (parent uploads filled anketa)
		&models.Questionnaire{},

		// CMS: video shorts for the main page stories section
		&models.VideoShort{},

		// CMS: vacancies
		&models.Vacancy{},

		// Tech support
		&models.SupportTicket{},
		&models.SupportMessage{},
		&models.SupportAttachment{},
	)

	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Create unique indexes manually to avoid GORM's DROP CONSTRAINT without IF EXISTS bug
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)")
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key)")
}
