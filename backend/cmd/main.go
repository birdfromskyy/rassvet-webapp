package main

import (
	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/services"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

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
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	r.Use(middleware.SecurityHeaders())

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

	// Document submissions handler
	documentHandler := handlers.NewDocumentHandler(db)

	// Notification handler
	notificationHandler := handlers.NewNotificationHandler(db)

	// New feature handlers
	consultationHandler  := handlers.NewConsultationHandler(db)
	achievementHandler   := handlers.NewAchievementHandler(db)
	awardHandler         := handlers.NewAwardHandler(db)
	questionnaireHandler := handlers.NewQuestionnaireHandler(db, rdb)

	// Shorts (video) handler
	shortHandler := handlers.NewShortHandler(db)

	// Vacancies handler
	vacancyHandler := handlers.NewVacancyHandler(db)

	// CMS handlers
	cmsFileHandler := handlers.NewCmsFileHandler(db)
	historyHandler := handlers.NewHistoryHandler(db)
	articleHandler := handlers.NewArticleHandler(db)
	serviceCmsHandler := handlers.NewServiceCmsHandler(db)
	finZoneHandler := handlers.NewFinZoneHandler(db)
	siteSettingHandler := handlers.NewSiteSettingHandler(db)

	// Health check
	r.GET("/api/health", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(503, gin.H{"status": "unhealthy", "db": "down"})
			return
		}
		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			c.JSON(503, gin.H{"status": "unhealthy", "redis": "down"})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Public auth routes (rate limited per IP)
	r.POST("/api/register",       middleware.IPRateLimit(rdb, 5, 15*time.Minute), authHandler.Register)
	r.POST("/api/login",          middleware.IPRateLimit(rdb, 15, 5*time.Minute), authHandler.Login)
	r.POST("/api/verify-email",   middleware.IPRateLimit(rdb, 10, 5*time.Minute), authHandler.VerifyEmail)
	r.POST("/api/resend-code",    middleware.IPRateLimit(rdb, 5, 5*time.Minute),  authHandler.ResendCode)
	r.POST("/api/forgot-password",middleware.IPRateLimit(rdb, 5, 15*time.Minute), authHandler.ForgotPassword)
	r.POST("/api/reset-password", middleware.IPRateLimit(rdb, 10, 15*time.Minute), authHandler.ResetPassword)
	r.POST("/api/refresh",        middleware.IPRateLimit(rdb, 30, 5*time.Minute),  authHandler.Refresh)

	// Consultation request — public (rate limited: 3 per hour per IP for guests)
	r.POST("/api/consultations", middleware.IPRateLimit(rdb, 3, 60*time.Minute), consultationHandler.Create)

	// Public CMS: achievements, awards, vacancies
	r.GET("/api/achievements", achievementHandler.GetPublic)
	r.GET("/api/awards", awardHandler.GetPublic)
	r.GET("/api/shorts", shortHandler.GetPublic)
	r.GET("/api/vacancies", vacancyHandler.GetPublic)

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
	r.GET("/api/reviews", reviewHandler.GetPublishedReviews)

	// Protected API routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.PUT("/profile", authHandler.UpdateProfile)
		protected.DELETE("/me", authHandler.DeleteMyAccount)
		protected.POST("/logout", authHandler.Logout)
		protected.GET("/me", authHandler.GetMe)

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
			admin.POST("/reviews/external", reviewHandler.AdminCreateReview)

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
			admin.GET("/schedules/:id/slots/:slotId/attendance", scheduleHandler.GetSlotAttendance)
			admin.POST("/schedules/:id/slots/:slotId/attendance", scheduleHandler.AddSlotStudent)
			admin.PATCH("/schedules/:id/slots/:slotId/attendance/:studentId", scheduleHandler.UpdateAttendance)
			admin.DELETE("/schedules/:id/slots/:slotId/attendance/:studentId", scheduleHandler.RemoveSlotStudent)
			admin.POST("/schedules/:id/clear-auto", scheduleHandler.ClearAutoSchedule)
			admin.POST("/schedules/:id/clear-manual", scheduleHandler.ClearManualSlots)
			admin.POST("/schedules/:id/copy-manual-from-prev-week", scheduleHandler.CopyManualSlotsFromPrevWeek)
			admin.PATCH("/schedules/:id/slots/bulk-origin", scheduleHandler.BulkUpdateSlotsOrigin)

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

			// Document submissions (admin review)
			admin.GET("/documents", documentHandler.AdminListDocuments)
			admin.PUT("/documents/submissions/:id/status", documentHandler.AdminUpdateSubmissionStatus)
			admin.POST("/documents/submissions/:id/anonymize", documentHandler.AdminAnonymizeSubmission)
			admin.DELETE("/documents/submissions/:id", documentHandler.AdminDeleteSubmission)
			admin.PUT("/documents/parent/:userId/status", documentHandler.AdminUpdateParentStatus)
			admin.POST("/documents/parent/:userId/anonymize", documentHandler.AdminAnonymizeParentProfile)
			admin.DELETE("/documents/parent/:userId", documentHandler.AdminDeleteParentProfile)
			admin.DELETE("/documents/user/:userId/personal-data", documentHandler.AdminDeletePersonalData)

			// Users
			admin.GET("/users", userStudentHandler.GetUsers)
			admin.POST("/users", userStudentHandler.CreateUser)
			admin.PUT("/users/:id", userStudentHandler.UpdateUser)
			admin.DELETE("/users/:id", userStudentHandler.DeleteUser)
			admin.GET("/users/:id/children", userStudentHandler.GetUserChildren)
			admin.POST("/users/:id/children", userStudentHandler.AddUserChild)
			admin.DELETE("/users/:id/children/:studentId", userStudentHandler.RemoveUserChild)

			// Consultations
			admin.GET("/consultations", consultationHandler.AdminList)
			admin.PUT("/consultations/:id", consultationHandler.AdminUpdate)
			admin.POST("/consultations/:id/anonymize", consultationHandler.AdminAnonymize)
			admin.DELETE("/consultations/:id", consultationHandler.AdminDelete)

			// Achievements CMS
			admin.GET("/achievements", achievementHandler.GetAll)
			admin.POST("/achievements", achievementHandler.Create)
			admin.PUT("/achievements/:id", achievementHandler.Update)
			admin.DELETE("/achievements/:id", achievementHandler.Delete)

			// Awards CMS
			admin.GET("/awards", awardHandler.GetAll)
			admin.POST("/awards", awardHandler.Create)
			admin.PUT("/awards/:id", awardHandler.Update)
			admin.DELETE("/awards/:id", awardHandler.Delete)

			// Shorts CMS (video stories on main page)
			admin.GET("/shorts", shortHandler.GetAll)
			admin.POST("/shorts", shortHandler.Create)
			admin.PUT("/shorts/:id", shortHandler.Update)
			admin.DELETE("/shorts/:id", shortHandler.Delete)

			// Vacancies CMS
			admin.GET("/vacancies", vacancyHandler.GetAll)
			admin.POST("/vacancies", vacancyHandler.Create)
			admin.PUT("/vacancies/:id", vacancyHandler.Update)
			admin.DELETE("/vacancies/:id", vacancyHandler.Delete)


			// Questionnaires review
			admin.GET("/questionnaires", questionnaireHandler.AdminList)
			admin.GET("/questionnaires/:id/file", questionnaireHandler.AdminServeFile)
			admin.PUT("/questionnaires/:id/status", questionnaireHandler.AdminUpdateStatus)
			admin.POST("/questionnaires/:id/anonymize", questionnaireHandler.AdminAnonymize)
			admin.DELETE("/questionnaires/:id", questionnaireHandler.AdminDelete)
		}

		protected.GET("/my-children", userStudentHandler.GetMyChildren)
		protected.GET("/my-children/:studentId/schedule", userStudentHandler.GetChildSchedule)
		protected.GET("/teacher/schedule", userStudentHandler.GetTeacherPublishedSchedule)
		protected.GET("/teacher/schedule/options", userStudentHandler.GetTeacherScheduleOptions)

		// Private file serving — cookie auth via AuthMiddleware
		protected.GET("/documents/file/:filename", documentHandler.ServePrivateFile)

		// Document submissions (parent + children docs)
		protected.GET("/documents", documentHandler.GetMyDocuments)
		protected.POST("/documents/parent", documentHandler.SaveParentDocs)
		protected.DELETE("/documents/parent", documentHandler.DeleteMyParentProfile)
		protected.POST("/documents/children", documentHandler.AddChildDocs)
		protected.DELETE("/documents/children/:id", documentHandler.DeleteChildSubmission)
		protected.PUT("/documents/children/:id", documentHandler.UpdateChildDocs)

		// Notifications
		protected.GET("/notifications", notificationHandler.GetMyNotifications)
		protected.GET("/notifications/unread-count", notificationHandler.GetUnreadCount)
		protected.PUT("/notifications/read-all", notificationHandler.MarkAllRead)
		protected.PUT("/notifications/:id/read", notificationHandler.MarkOneRead)

		// Consultation (auth user — attaches user_id)
		protected.POST("/consultations/auth", consultationHandler.Create)
		protected.GET("/consultations/mine", consultationHandler.GetMine)

		// Questionnaire (anketa)
		protected.GET("/questionnaire", questionnaireHandler.GetMine)
		protected.POST("/questionnaire", questionnaireHandler.Upload)
		protected.GET("/questionnaire/file", questionnaireHandler.ServeFile)
	}

	// Background context — cancelled on graceful shutdown to stop background workers.
	bgCtx, bgCancel := context.WithCancel(context.Background())

	// Background goroutine: daily check for expired ИППСУ → create in-app notifications.
	go func() {
		type row struct {
			ID              uint
			ChildName       string
			IppsuExpiryDate *time.Time
			UserID          uint
			UserFirstName   string
			UserLastName    string
		}
		for {
			var rows []row
			db.Raw(`
				SELECT c.id, c.child_name, c.ippsu_expiry_date, c.user_id,
				       u.first_name AS user_first_name, u.last_name AS user_last_name
				FROM child_doc_submissions c
				JOIN users u ON u.id = c.user_id
				WHERE c.deleted_at IS NULL
				  AND c.status = 'approved'
				  AND c.ippsu_expiry_date IS NOT NULL
				  AND c.ippsu_expiry_date < NOW()
				  AND c.expiry_notified = false
			`).Scan(&rows)

			for _, r := range rows {
				expiryStr := ""
				if r.IppsuExpiryDate != nil {
					expiryStr = r.IppsuExpiryDate.Format("02.01.2006")
				}
				fullName := strings.TrimSpace(r.UserLastName + " " + r.UserFirstName)

				handlers.CreateNotification(db, r.UserID, "",
					"Срок действия ИППСУ истёк",
					"Срок действия документа ИППСУ для ребёнка «"+r.ChildName+"» истёк "+expiryStr+
						". Пожалуйста, загрузите обновлённый документ в личном кабинете.",
					"/profile",
				)
				handlers.CreateNotification(db, 0, "admin",
					"Истёк срок ИППСУ",
					"У клиента "+fullName+" истёк срок действия ИППСУ для ребёнка «"+r.ChildName+"» ("+expiryStr+").",
					"/admin/documents",
				)
				db.Model(&models.ChildDocSubmission{}).
					Where("id = ?", r.ID).
					Update("expiry_notified", true)
			}

			select {
			case <-bgCtx.Done():
				return
			case <-time.After(24 * time.Hour):
			}
		}
	}()

	// HTTP server with explicit timeouts.
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Block until SIGINT or SIGTERM.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutdown signal received, draining connections...")

	bgCancel() // Stop background workers.

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped cleanly")
}
