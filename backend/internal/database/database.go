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
	err := db.AutoMigrate(
		// Старые модели
		&models.User{},
		&models.Review{},
		&models.VerificationCode{},
		&models.PasswordResetCode{},

		// Новые модели расписания
		&models.Subject{},
		&models.Teacher{},
		&models.TeacherSubject{},
		&models.Room{},
		&models.RoomSubject{},
		&models.Student{},
		&models.StudentAvailability{},
		&models.TeacherAvailability{},
		&models.Assignment{},
		&models.AssignmentWeekOverride{},
		&models.Schedule{},
		&models.ScheduleSlot{},
		&models.ScheduleGenerationIssue{},
	)

	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
}
