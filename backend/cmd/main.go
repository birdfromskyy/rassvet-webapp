package main

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto migrate
	database.Migrate(db)

	// Setup Gin
	r := gin.Default()

	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	reviewHandler := handlers.NewReviewHandler(db)
	adminHandler := handlers.NewAdminHandler(db)

	// Public routes
	r.POST("/api/register", authHandler.Register)
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/verify-email", authHandler.VerifyEmail)
	r.POST("/api/resend-code", authHandler.ResendCode)

	// Protected routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.POST("/logout", authHandler.Logout)
		protected.GET("/me", authHandler.GetMe)

		// Review routes
		protected.GET("/reviews", reviewHandler.GetPublishedReviews)
		protected.POST("/reviews", reviewHandler.CreateReview)
		protected.GET("/my-reviews", reviewHandler.GetMyReviews)

		// Admin routes
		admin := protected.Group("/admin")
		admin.Use(middleware.AdminMiddleware())
		{
			admin.GET("/reviews", adminHandler.GetAllReviews)
			admin.GET("/reviews/pending", adminHandler.GetPendingReviews)
			admin.PUT("/reviews/:id", adminHandler.UpdateReview)
			admin.DELETE("/reviews/:id", adminHandler.DeleteReview)
			admin.PUT("/reviews/:id/approve", adminHandler.ApproveReview)
			admin.PUT("/reviews/:id/reject", adminHandler.RejectReview)
		}
	}

	r.Run(":" + cfg.Port)
}
