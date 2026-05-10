package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost        string
	DBUser        string
	DBPassword    string
	DBName        string
	DBPort        string
	JWTSecret     string
	Port          string
	EmailFrom     string
	EmailPassword string
	SMTPHost      string
	SMTPPort      string

	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       string
}

func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	return &Config{
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBUser:        getEnv("DB_USER", "postgres"),
		DBPassword:    getEnv("DB_PASSWORD", "postgres"),
		DBName:        getEnv("DB_NAME", "reviews_db"),
		DBPort:        getEnv("DB_PORT", "5432"),
		JWTSecret:     getEnv("JWT_SECRET", "secret"),
		Port:          getEnv("PORT", "8080"),
		EmailFrom:     getEnv("EMAIL_FROM", ""),
		EmailPassword: getEnv("EMAIL_PASSWORD", ""),
		SMTPHost:      getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:      getEnv("SMTP_PORT", "587"),

		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnv("REDIS_DB", "0"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
