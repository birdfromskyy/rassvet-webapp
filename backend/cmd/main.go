package main

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/services"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	rdb, err := database.InitializeRedis(cfg)
	if err != nil {
		log.Fatal("Failed to connect to redis:", err)
	}

	database.Migrate(db)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Serve uploaded files
	r.Static("/uploads", "./uploads")

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

	// CMS handlers
	cmsFileHandler := handlers.NewCmsFileHandler(db)
	historyHandler := handlers.NewHistoryHandler(db)
	articleHandler := handlers.NewArticleHandler(db)
	serviceCmsHandler := handlers.NewServiceCmsHandler(db)
	finZoneHandler := handlers.NewFinZoneHandler(db)
	siteSettingHandler := handlers.NewSiteSettingHandler(db)

	// Public auth routes
	r.POST("/api/register", authHandler.Register)
	r.POST("/api/login", authHandler.Login)
	r.POST("/api/verify-email", authHandler.VerifyEmail)
	r.POST("/api/resend-code", authHandler.ResendCode)
	r.POST("/api/forgot-password", authHandler.ForgotPassword)
	r.POST("/api/reset-password", authHandler.ResetPassword)

	// Public CMS routes (no auth required)
	r.GET("/api/employees", teacherHandler.GetPublicTeachers)
	r.GET("/api/cms-files", cmsFileHandler.GetBySection)
	r.GET("/api/history", historyHandler.GetEvents)
	r.GET("/api/articles", articleHandler.GetArticles)
	r.GET("/api/articles/categories", articleHandler.GetCategories)
	r.GET("/api/articles/:slug", articleHandler.GetArticleBySlug)
	r.GET("/api/services", serviceCmsHandler.GetServices)
	r.GET("/api/fin-zones", finZoneHandler.GetFinZones)
	r.GET("/api/site-settings", siteSettingHandler.GetAll)
	r.GET("/api/site-settings/:key", siteSettingHandler.GetByKey)

	// Protected API routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret, rdb))
	{
		protected.PUT("/profile", authHandler.UpdateProfile)
		protected.POST("/logout", authHandler.Logout)
		protected.GET("/me", authHandler.GetMe)

		protected.GET("/reviews", reviewHandler.GetPublishedReviews)
		protected.POST("/reviews", reviewHandler.CreateReview)
		protected.GET("/my-reviews", reviewHandler.GetMyReviews)
		protected.GET("/reviews/check", reviewHandler.CheckUserReview)
		protected.PUT("/reviews/my", reviewHandler.UpdateMyReview)

		admin := protected.Group("/admin")
		admin.Use(middleware.AdminMiddleware())
		{
			// Reviews
			admin.GET("/reviews", adminHandler.GetAllReviews)
			admin.GET("/reviews/pending", adminHandler.GetPendingReviews)
			admin.PUT("/reviews/:id", adminHandler.UpdateReview)
			admin.DELETE("/reviews/:id", adminHandler.DeleteReview)
			admin.PUT("/reviews/:id/approve", adminHandler.ApproveReview)
			admin.PUT("/reviews/:id/reject", adminHandler.RejectReview)

			// File upload
			admin.POST("/upload", handlers.UploadFile)

			// CMS — Employees managed via /admin/teachers (CMS fields added to Teacher model)

			// CMS — Files (docs, rules, rating)
			admin.GET("/cms-files", cmsFileHandler.GetAllBySection)
			admin.POST("/cms-files", cmsFileHandler.CreateFile)
			admin.PUT("/cms-files/:id", cmsFileHandler.UpdateFile)
			admin.DELETE("/cms-files/:id", cmsFileHandler.DeleteFile)

			// CMS — History
			admin.GET("/history", historyHandler.GetEvents)
			admin.POST("/history", historyHandler.CreateEvent)
			admin.PUT("/history/:id", historyHandler.UpdateEvent)
			admin.DELETE("/history/:id", historyHandler.DeleteEvent)

			// CMS — Articles (news)
			admin.GET("/articles", articleHandler.GetAllArticles)
			admin.GET("/articles/:id", articleHandler.GetArticleByID)
			admin.POST("/articles", articleHandler.CreateArticle)
			admin.PUT("/articles/:id", articleHandler.UpdateArticle)
			admin.DELETE("/articles/:id", articleHandler.DeleteArticle)

			// CMS — Services (/about_services)
			admin.GET("/services", serviceCmsHandler.GetAllServices)
			admin.POST("/services", serviceCmsHandler.CreateService)
			admin.PUT("/services/:id", serviceCmsHandler.UpdateService)
			admin.DELETE("/services/:id", serviceCmsHandler.DeleteService)

			// CMS — Fin zones (/fin_activities)
			admin.GET("/fin-zones", finZoneHandler.GetAllFinZones)
			admin.POST("/fin-zones", finZoneHandler.CreateFinZone)
			admin.PUT("/fin-zones/:id", finZoneHandler.UpdateFinZone)
			admin.DELETE("/fin-zones/:id", finZoneHandler.DeleteFinZone)

			// CMS — Site settings
			admin.PUT("/site-settings", siteSettingHandler.Upsert)
			admin.PUT("/site-settings/bulk", siteSettingHandler.UpsertBulk)

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
			admin.GET("/teachers/:id/rooms", teacherHandler.GetTeacherRooms)
			admin.PUT("/teachers/:id/rooms", teacherHandler.UpdateTeacherRooms)

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
			admin.POST("/schedules", scheduleHandler.CreateEmptySchedule)
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
			admin.POST("/schedules/:id/clear-auto", scheduleHandler.ClearAutoSchedule)
			admin.POST("/schedules/:id/clear-manual", scheduleHandler.ClearManualSlots)
			admin.POST("/schedules/:id/copy-manual-from-prev-week", scheduleHandler.CopyManualSlotsFromPrevWeek)

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

			// Reports
			admin.GET("/reports/monthly", reportHandler.GetMonthlyReport)

			// Users
			admin.GET("/users", userStudentHandler.GetUsers)
			admin.POST("/users", userStudentHandler.CreateUser)
			admin.PUT("/users/:id", userStudentHandler.UpdateUser)
			admin.GET("/users/:id/children", userStudentHandler.GetUserChildren)
			admin.POST("/users/:id/children", userStudentHandler.AddUserChild)
			admin.DELETE("/users/:id/children/:studentId", userStudentHandler.RemoveUserChild)
		}

		protected.GET("/my-children", userStudentHandler.GetMyChildren)
		protected.GET("/my-children/:studentId/schedule", userStudentHandler.GetChildSchedule)
		protected.GET("/teacher/schedule", userStudentHandler.GetTeacherPublishedSchedule)
		protected.GET("/teacher/schedule/options", userStudentHandler.GetTeacherScheduleOptions)
	}

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
