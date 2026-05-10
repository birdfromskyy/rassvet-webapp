package main

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/services"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func serveHTML(siteDir string, fileName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		fullPath := filepath.Join(siteDir, fileName)

		if _, err := os.Stat(fullPath); err != nil {
			c.String(http.StatusNotFound, "Page not found")
			return
		}

		c.File(fullPath)
	}
}

func main() {
	// Load config
	cfg := config.Load()

	// Initialize PostgreSQL
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Initialize Redis
	rdb, err := database.InitializeRedis(cfg)
	if err != nil {
		log.Fatal("Failed to connect to redis:", err)
	}

	// Auto migrate only our models
	database.Migrate(db)

	// Setup Gin
	r := gin.Default()

	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, rdb, cfg)
	reviewHandler := handlers.NewReviewHandler(db)
	adminHandler := handlers.NewAdminHandler(db)

	subjectHandler := handlers.NewSubjectHandler(db)
	roomHandler := handlers.NewRoomHandler(db)
	studentHandler := handlers.NewStudentHandler(db)
	teacherHandler := handlers.NewTeacherHandler(db)
	assignmentHandler := handlers.NewAssignmentHandler(db)
	groupLessonHandler := handlers.NewGroupLessonHandler(db)
	reportHandler := handlers.NewReportHandler(db)

	scheduleGenerator := services.NewScheduleGenerator(db)
	scheduleHandler := handlers.NewScheduleHandler(db, scheduleGenerator)
	userStudentHandler := handlers.NewUserStudentHandler(db)

	// Public API routes
	r.POST("/api/register", authHandler.Register)
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/verify-email", authHandler.VerifyEmail)
	r.POST("/api/resend-code", authHandler.ResendCode)
	r.POST("/api/forgot-password", authHandler.ForgotPassword)
	r.POST("/api/reset-password", authHandler.ResetPassword)

	// Protected API routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.PUT("/profile", authHandler.UpdateProfile)
		protected.POST("/logout", authHandler.Logout)
		protected.GET("/me", authHandler.GetMe)

		// Review routes
		protected.GET("/reviews", reviewHandler.GetPublishedReviews)
		protected.POST("/reviews", reviewHandler.CreateReview)
		protected.GET("/my-reviews", reviewHandler.GetMyReviews)
		protected.GET("/reviews/check", reviewHandler.CheckUserReview)
		protected.PUT("/reviews/my", reviewHandler.UpdateMyReview)

		// Admin routes
		admin := protected.Group("/admin")
		admin.Use(middleware.AdminMiddleware())
		{
			// Existing admin review routes
			admin.GET("/reviews", adminHandler.GetAllReviews)
			admin.GET("/reviews/pending", adminHandler.GetPendingReviews)
			admin.PUT("/reviews/:id", adminHandler.UpdateReview)
			admin.DELETE("/reviews/:id", adminHandler.DeleteReview)
			admin.PUT("/reviews/:id/approve", adminHandler.ApproveReview)
			admin.PUT("/reviews/:id/reject", adminHandler.RejectReview)

			// Subjects
			admin.GET("/subjects", subjectHandler.GetSubjects)
			admin.GET("/subjects/:id", subjectHandler.GetSubjectByID)
			admin.POST("/subjects", subjectHandler.CreateSubject)
			admin.PUT("/subjects/:id", subjectHandler.UpdateSubject)
			admin.PATCH("/subjects/:id/deactivate", subjectHandler.DeactivateSubject)
			admin.DELETE("/subjects/:id", subjectHandler.DeleteSubject)

			// Rooms
			admin.GET("/rooms", roomHandler.GetRooms)
			admin.GET("/rooms/:id", roomHandler.GetRoomByID)
			admin.POST("/rooms", roomHandler.CreateRoom)
			admin.PUT("/rooms/:id", roomHandler.UpdateRoom)
			admin.PATCH("/rooms/:id/deactivate", roomHandler.DeactivateRoom)
			admin.DELETE("/rooms/:id", roomHandler.DeleteRoom)

			admin.GET("/rooms/:id/subjects", roomHandler.GetRoomSubjects)
			admin.PUT("/rooms/:id/subjects", roomHandler.UpdateRoomSubjects)

			// Students
			admin.GET("/students", studentHandler.GetStudents)
			admin.GET("/students/:id", studentHandler.GetStudentByID)
			admin.POST("/students", studentHandler.CreateStudent)
			admin.PUT("/students/:id", studentHandler.UpdateStudent)
			admin.PATCH("/students/:id/deactivate", studentHandler.DeactivateStudent)
			admin.DELETE("/students/:id", studentHandler.DeleteStudent)

			admin.GET("/students/:id/availability", studentHandler.GetStudentAvailability)
			admin.POST("/students/:id/availability", studentHandler.CreateStudentAvailability)
			admin.PUT("/students/:id/availability/:availabilityId", studentHandler.UpdateStudentAvailability)
			admin.DELETE("/students/:id/availability/:availabilityId", studentHandler.DeleteStudentAvailability)

			// Teachers
			admin.GET("/teachers", teacherHandler.GetTeachers)
			admin.GET("/teachers/:id", teacherHandler.GetTeacherByID)
			admin.POST("/teachers", teacherHandler.CreateTeacher)
			admin.PUT("/teachers/:id", teacherHandler.UpdateTeacher)
			admin.PATCH("/teachers/:id/deactivate", teacherHandler.DeactivateTeacher)
			admin.DELETE("/teachers/:id", teacherHandler.DeleteTeacher)

			admin.GET("/teachers/:id/subjects", teacherHandler.GetTeacherSubjects)
			admin.PUT("/teachers/:id/subjects", teacherHandler.UpdateTeacherSubjects)

			admin.GET("/teachers/:id/availability", teacherHandler.GetTeacherAvailability)
			admin.POST("/teachers/:id/availability", teacherHandler.CreateTeacherAvailability)
			admin.PUT("/teachers/:id/availability/:availabilityId", teacherHandler.UpdateTeacherAvailability)
			admin.DELETE("/teachers/:id/availability/:availabilityId", teacherHandler.DeleteTeacherAvailability)

			// Assignments
			admin.GET("/assignments", assignmentHandler.GetAssignments)
			admin.GET("/assignments/:id", assignmentHandler.GetAssignmentByID)
			admin.GET("/teachers/:id/assignments", assignmentHandler.GetTeacherAssignments)

			admin.POST("/assignments", assignmentHandler.CreateAssignment)
			admin.PUT("/assignments/:id", assignmentHandler.UpdateAssignment)
			admin.DELETE("/assignments/:id", assignmentHandler.DeleteAssignment)

			admin.GET("/assignment-week-overrides", assignmentHandler.GetAssignmentWeekOverrides)
			admin.POST("/assignments/:id/weekly-override", assignmentHandler.CreateAssignmentWeekOverride)
			admin.PUT("/assignments/:id/weekly-override/:overrideId", assignmentHandler.UpdateAssignmentWeekOverride)
			admin.DELETE("/assignments/:id/weekly-override/:overrideId", assignmentHandler.DeleteAssignmentWeekOverride)

			// Schedules
			admin.GET("/schedules", scheduleHandler.GetScheduleByWeek)
			admin.GET("/schedules/:id", scheduleHandler.GetScheduleByID)
			admin.POST("/schedules/generate", scheduleHandler.GenerateSchedule)
			admin.POST("/schedules/generate/async", scheduleHandler.StartGenerateSchedule)
			admin.GET("/schedule-generation-jobs/:jobId", scheduleHandler.GetGenerationJob)
			admin.POST("/schedules/:id/approve", scheduleHandler.ApproveSchedule)
			admin.POST("/schedules/:id/unapprove", scheduleHandler.UnapproveSchedule)
			admin.POST("/schedules/:id/reset-auto", scheduleHandler.ResetAutoSchedule)
			admin.POST("/schedules/:id/reset-auto/async", scheduleHandler.StartResetAutoSchedule)

			admin.POST("/schedules/:id/slots", scheduleHandler.CreateScheduleSlot)
			admin.PUT("/schedules/:id/slots/:slotId", scheduleHandler.UpdateScheduleSlot)
			admin.PATCH("/schedules/:id/slots/:slotId/pin", scheduleHandler.PinScheduleSlot)
			admin.PATCH("/schedules/:id/slots/:slotId/unpin", scheduleHandler.UnpinScheduleSlot)
			admin.DELETE("/schedules/:id/slots/:slotId", scheduleHandler.DeleteScheduleSlot)
			admin.POST("/schedules/:id/slots/:slotId/exclusions", scheduleHandler.AddSlotExclusion)
			admin.DELETE("/schedules/:id/slots/:slotId/exclusions/:studentId", scheduleHandler.RemoveSlotExclusion)

			// Group lessons
			admin.GET("/group-lessons", groupLessonHandler.GetGroupLessons)
			admin.GET("/group-lessons/:id", groupLessonHandler.GetGroupLessonByID)
			admin.POST("/group-lessons", groupLessonHandler.CreateGroupLesson)
			admin.PUT("/group-lessons/:id", groupLessonHandler.UpdateGroupLesson)
			admin.DELETE("/group-lessons/:id", groupLessonHandler.DeleteGroupLesson)

			admin.GET("/group-lessons/:id/enrollments", groupLessonHandler.GetEnrollments)
			admin.POST("/group-lessons/:id/enrollments", groupLessonHandler.AddEnrollment)
			admin.DELETE("/group-lessons/:id/enrollments/:studentId", groupLessonHandler.RemoveEnrollment)

			admin.GET("/group-lessons/:id/week-overrides", groupLessonHandler.GetWeekOverrides)
			admin.POST("/group-lessons/:id/week-overrides", groupLessonHandler.CreateWeekOverride)
			admin.DELETE("/group-lessons/:id/week-overrides/:overrideId", groupLessonHandler.DeleteWeekOverride)

			// Teacher rooms
			admin.GET("/teachers/:id/rooms", teacherHandler.GetTeacherRooms)
			admin.PUT("/teachers/:id/rooms", teacherHandler.UpdateTeacherRooms)

			// Clear auto schedule without regenerating
			admin.POST("/schedules/:id/clear-auto", scheduleHandler.ClearAutoSchedule)

			// Reports
			admin.GET("/reports/monthly", reportHandler.GetMonthlyReport)

			// User-student links
			admin.GET("/users", userStudentHandler.GetUsers)
			admin.POST("/users", userStudentHandler.CreateUser)
			admin.PUT("/users/:id", userStudentHandler.UpdateUser)
			admin.GET("/users/:id/children", userStudentHandler.GetUserChildren)
			admin.POST("/users/:id/children", userStudentHandler.AddUserChild)
			admin.DELETE("/users/:id/children/:studentId", userStudentHandler.RemoveUserChild)
		}

		// Parent routes (any authenticated user)
		protected.GET("/my-children", userStudentHandler.GetMyChildren)
		protected.GET("/my-children/:studentId/schedule", userStudentHandler.GetChildSchedule)
		protected.GET("/teacher/schedule", userStudentHandler.GetTeacherPublishedSchedule)
		protected.GET("/teacher/schedule/options", userStudentHandler.GetTeacherScheduleOptions)
	}

	siteDir := "./static/site"

	r.NoRoute(func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "404.html"))
	})

	// Static assets from exported Tilda site
	r.Static("/css", filepath.Join(siteDir, "css"))
	r.Static("/js", filepath.Join(siteDir, "js"))
	r.Static("/images", filepath.Join(siteDir, "images"))
	r.Static("/files", filepath.Join(siteDir, "files"))

	// Static files
	r.GET("/robots.txt", func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "robots.txt"))
	})
	r.GET("/sitemap.xml", func(c *gin.Context) {
		c.File(filepath.Join(siteDir, "sitemap.xml"))
	})
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	r.GET("/reviews", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "http://localhost:3000/reviews")
	})

	// Public Tilda pages
	r.GET("/", serveHTML(siteDir, "main.html"))
	r.GET("/main", serveHTML(siteDir, "main.html"))

	r.GET("/about_services", serveHTML(siteDir, "about_services.html"))
	r.GET("/available_services", serveHTML(siteDir, "available_services.html"))
	r.GET("/contacts", serveHTML(siteDir, "contacts.html"))
	r.GET("/docs", serveHTML(siteDir, "docs.html"))
	r.GET("/employees", serveHTML(siteDir, "employees.html"))
	r.GET("/fin_activities", serveHTML(siteDir, "fin_activities.html"))
	r.GET("/history", serveHTML(siteDir, "history.html"))
	r.GET("/how_to", serveHTML(siteDir, "how_to.html"))
	r.GET("/internal_rules", serveHTML(siteDir, "internal_rules.html"))
	r.GET("/mission", serveHTML(siteDir, "mission.html"))
	r.GET("/quantity_of_services", serveHTML(siteDir, "quantity_of_services.html"))
	r.GET("/rating", serveHTML(siteDir, "rating.html"))
	r.GET("/social_service", serveHTML(siteDir, "social_service.html"))
	r.GET("/structure", serveHTML(siteDir, "structure.html"))
	r.GET("/vacancies", serveHTML(siteDir, "vacancies.html"))
	r.GET("/want_to_help", serveHTML(siteDir, "want_to_help.html"))

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
