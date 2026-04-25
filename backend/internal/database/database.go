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
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN assignment_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN student_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN teacher_id DROP NOT NULL")
	db.Exec("ALTER TABLE schedule_generation_issues ALTER COLUMN subject_id DROP NOT NULL")

	err := db.AutoMigrate(
		// Auth models
		&models.User{},
		&models.Review{},
		&models.VerificationCode{},

		// Schedule module models
		&models.Subject{},
		&models.Teacher{},
		&models.TeacherSubject{},
		&models.TeacherRoom{},
		&models.Room{},
		&models.RoomSubject{},
		&models.Student{},
		&models.StudentAvailability{},
		&models.TeacherAvailability{},
		&models.Assignment{},
		&models.AssignmentWeekOverride{},
		&models.GroupLesson{},
		&models.GroupLessonEnrollment{},
		&models.GroupLessonWeekOverride{},
		&models.Schedule{},
		&models.ScheduleSlot{},
		&models.ScheduleSlotExclusion{},
		&models.ScheduleGenerationIssue{},
		&models.UserStudent{},
	)

	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
}
