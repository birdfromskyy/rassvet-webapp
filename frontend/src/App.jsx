import React, { lazy, Suspense, useEffect, useState } from "react";
import authService from "./services/authService";
import { AuthContext } from "./contexts/AuthContext";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import StaleBanner from "./components/StaleBanner/StaleBanner";
import usePageFreshness from "./hooks/usePageFreshness";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import AccessibilityPanel from "./components/AccessibilityPanel/AccessibilityPanel";

const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));
const ServicesListPage = lazy(() => import("./pages/ServicesListPage/ServicesListPage"));
const Mission = lazy(() => import("./pages/Mission/Mission"));
const History = lazy(() => import("./pages/History/History"));
const Docs = lazy(() => import("./pages/Docs/Docs"));
const Employees = lazy(() => import("./pages/Employees/Employees"));
const AvailablePlaces = lazy(() => import("./pages/AvailablePlaces/AvailablePlaces"));
const InternalRules = lazy(() => import("./pages/InternalRules/InternalRules"));
const Structure = lazy(() => import("./pages/Structure/Structure"));
const Rating = lazy(() => import("./pages/Rating/Rating"));
const ServicesDescription = lazy(() => import("./pages/ServicesDescription/ServicesDescription"));
const Contacts = lazy(() => import("./pages/Contacts/Contacts"));
const Donation = lazy(() => import("./pages/Donation/Donation"));
const SocialServiceForm = lazy(() => import("./pages/SocialServiceForm/SocialServiceForm"));
const Awards = lazy(() => import("./pages/Awards/Awards"));
const Login = lazy(() => import("./pages/Login/Login"));
const Register = lazy(() => import("./pages/Register/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Reviews = lazy(() => import("./pages/Reviews/Reviews"));
const CreateReview = lazy(() => import("./pages/CreateReview/CreateReview"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const PendingReviews = lazy(() => import("./pages/PendingReviews"));
const News = lazy(() => import("./pages/News/News"));
const NewsDetail = lazy(() => import("./pages/NewsDetail/NewsDetail"));
const AdminNews = lazy(() => import("./pages/AdminNews"));
const AdminNewsPreview = lazy(() => import("./pages/AdminNewsPreview"));
const AdminSchedulePanel = lazy(() => import("./pages/AdminSchedulePanel"));
const AdminSubjects = lazy(() => import("./pages/AdminSubjects"));
const AdminTeachers = lazy(() => import("./pages/AdminTeachers"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminStudentServiceValidities = lazy(() => import("./pages/AdminStudentServiceValidities"));
const AdminRooms = lazy(() => import("./pages/AdminRooms"));
const AdminAssignments = lazy(() => import("./pages/AdminAssignments"));
const AdminSchedule = lazy(() => import("./pages/AdminSchedule"));
const AdminGroupLessons = lazy(() => import("./pages/AdminGroupLessons"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminMonthlySocialServices = lazy(() => import("./pages/AdminMonthlySocialServices"));
const AdminStaffDates = lazy(() => import("./pages/AdminStaffDates"));
const AdminCmsFiles = lazy(() => import("./pages/AdminCmsFiles"));
const AdminHistory = lazy(() => import("./pages/AdminHistory"));
const AdminFinZones = lazy(() => import("./pages/AdminFinZones"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminSiteSettings = lazy(() => import("./pages/AdminSiteSettings"));
const AdminCMSPanel = lazy(() => import("./pages/AdminCMSPanel/AdminCMSPanel"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments"));
const AdminConsultations = lazy(() => import("./pages/AdminConsultations"));
const AdminAchievements = lazy(() => import("./pages/AdminAchievements"));
const AdminAchievementPreview = lazy(() => import("./pages/AdminAchievementPreview"));
const AdminAwards = lazy(() => import("./pages/AdminAwards"));
const AdminShorts = lazy(() => import("./pages/AdminShorts"));
const AdminVacancies = lazy(() => import("./pages/AdminVacancies"));
const AdminQuestionnaires = lazy(() => import("./pages/AdminQuestionnaires"));
const ChildSchedule = lazy(() => import("./pages/ChildSchedule"));
const TeacherSchedule = lazy(() => import("./pages/TeacherSchedule"));
const SupportList = lazy(() => import("./pages/Support/SupportList"));
const SupportNew = lazy(() => import("./pages/Support/SupportNew"));
const SupportTicket = lazy(() => import("./pages/Support/SupportTicket"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const AdminSupportTicket = lazy(() => import("./pages/AdminSupportTicket"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword/ForgotPassword"));
const Profile = lazy(() => import("./pages/Profile/Profile"));
const FinActivities = lazy(() => import("./pages/FinActivities/FinActivities"));
const ServiceAlgorithm = lazy(() => import("./pages/ServiceAlgorithm/ServiceAlgorithm"));
const Achievements = lazy(() => import("./pages/Achievements/Achievements"));
const AchievementDetail = lazy(() => import("./pages/Achievements/AchievementDetail"));
const ConsultationRequest = lazy(() => import("./pages/ConsultationRequest/ConsultationRequest"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy/PrivacyPolicy"));
const AdminPrivacyPolicy = lazy(() => import("./pages/AdminPrivacyPolicy/AdminPrivacyPolicy"));
const Vacancies = lazy(() => import("./pages/Vacancies/Vacancies"));
const CommercialTariffs = lazy(() => import("./pages/CommercialTariffs/CommercialTariffs"));
const AdminCommercialTariffs = lazy(() => import("./pages/AdminCommercialTariffs"));
const AdminVKNotifications = lazy(() => import("./pages/AdminVKNotifications"));

const PageLoader = () => (
  <div className="app-page-loader" role="status" aria-live="polite">
    Загрузка страницы…
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const stalePage = usePageFreshness();

  useEffect(() => {
    authService.getMe()
      .then(userData => {
        setIsAuthenticated(true);
        setUser(userData);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleUpdateUser = (updatedUser) => {
    if (
      updatedUser.is_verified === false &&
      updatedUser.email !== user?.email
    ) {
      return;
    }
    setUser(updatedUser);
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, handleLogin, handleLogout, handleUpdateUser }}>
      <AccessibilityPanel />
      <StaleBanner show={stalePage} />
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/profile"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Profile
                user={user}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            </PrivateRoute>
          }
        />
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLogin={handleLogin} />
            ) : (
              <Navigate to="/main" />
            )
          }
        />
        <Route
          path="/register"
          element={
            !isAuthenticated ? <Register /> : <Navigate to="/main" />
          }
        />
        <Route
          path="/verify-email"
          element={
            !isAuthenticated ? <VerifyEmail /> : <Navigate to="/main" />
          }
        />

        {/* Публичные маршруты для новостей */}
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<NewsDetail />} />

        {/* Отзывы: смотреть может любой, оставить — только авторизованный */}
        <Route path="/reviews" element={<Reviews user={user} />} />

        <Route element={<PrivateRoute isAuthenticated={isAuthenticated} />}>
          <Route
            path="/dashboard"
            element={<Dashboard user={user} onLogout={handleLogout} />}
          />
          <Route
            path="/create-review"
            element={
              user?.role === "teacher" ? (
                <Navigate to="/reviews" />
              ) : (
                <CreateReview />
              )
            }
          />
          <Route path="/support" element={<SupportList />} />
          <Route path="/support/new" element={<SupportNew />} />
          <Route path="/support/:id" element={<SupportTicket />} />

          <Route
            path="/my-schedule"
            element={
              user?.teacher_id ? (
                <TeacherSchedule user={user} />
              ) : (
                <ChildSchedule user={user} />
              )
            }
          />
          <Route
            path="/teacher/schedule"
            element={<TeacherSchedule user={user} />}
          />

          <Route element={<AdminRoute user={user} />}>
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/pending-reviews" element={<PendingReviews />} />
            <Route path="/admin/news" element={<AdminNews />} />
            <Route
              path="/admin/news/:id/preview"
              element={<AdminNewsPreview />}
            />
            <Route path="/admin/achievements/:id/preview" element={<AdminAchievementPreview />} />
            <Route path="/admin/schedule" element={<AdminSchedulePanel />} />
            <Route
              path="/admin/schedule/subjects"
              element={<AdminSubjects />}
            />
            <Route
              path="/admin/schedule/teachers"
              element={<AdminTeachers />}
            />
            <Route
              path="/admin/schedule/students"
              element={<AdminStudents />}
            />
            <Route
              path="/admin/schedule/service-validities"
              element={<AdminStudentServiceValidities />}
            />
            <Route path="/admin/schedule/rooms" element={<AdminRooms />} />
            <Route
              path="/admin/schedule/assignments"
              element={<AdminAssignments />}
            />
            <Route
              path="/admin/schedule/group-lessons"
              element={<AdminGroupLessons />}
            />
            <Route path="/admin/schedule/tariffs" element={<AdminCommercialTariffs />} />
            <Route path="/admin/schedule/weekly" element={<AdminSchedule />} />
            <Route path="/admin/schedule/reports" element={<AdminReports />} />
            <Route path="/admin/schedule/social-service-reports" element={<AdminMonthlySocialServices />} />
            <Route path="/admin/schedule/staff-dates" element={<AdminStaffDates />} />
            <Route path="/admin/users" element={<AdminUsers />} />

            {/* Documents review */}
            <Route path="/admin/documents" element={<AdminDocuments />} />

            {/* Consultations & Questionnaires */}
            <Route path="/admin/consultations" element={<AdminConsultations />} />
            <Route path="/admin/questionnaires" element={<AdminQuestionnaires />} />

            {/* Tech support */}
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/support/:id" element={<AdminSupportTicket />} />

            {/* CMS hub */}
            <Route path="/admin/cms" element={<AdminCMSPanel />} />

            {/* CMS routes */}
            <Route path="/admin/cms/news" element={<AdminNews />} />
            <Route
              path="/admin/cms/docs"
              element={<AdminCmsFiles section="docs" title="Документы" />}
            />
            <Route
              path="/admin/cms/rules"
              element={
                <AdminCmsFiles
                  section="rules"
                  title="Правила внутреннего распорядка"
                />
              }
            />
            <Route
              path="/admin/cms/rating"
              element={
                <AdminCmsFiles
                  section="rating"
                  title="Независимая оценка качества"
                />
              }
            />
            <Route path="/admin/cms/history" element={<AdminHistory />} />
            <Route path="/admin/cms/fin-zones" element={<AdminFinZones />} />
            <Route path="/admin/cms/services" element={<AdminServices />} />
            <Route path="/admin/cms/commercial-tariffs" element={<Navigate to="/admin/schedule/tariffs" replace />} />
            <Route path="/admin/cms/settings" element={<AdminSiteSettings />} />
            <Route path="/admin/cms/vk-notifications" element={<AdminVKNotifications />} />
            <Route path="/admin/cms/achievements" element={<AdminAchievements />} />
            <Route path="/admin/cms/awards" element={<AdminAwards />} />
            <Route path="/admin/cms/shorts" element={<AdminShorts />} />
            <Route path="/admin/cms/vacancies" element={<AdminVacancies />} />
            <Route path="/admin/cms/privacy" element={<AdminPrivacyPolicy />} />
          </Route>
        </Route>

        <Route path="/consultation-request" element={<ConsultationRequest user={user} />} />
        <Route path="/main" element={<Home />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/mission" element={<Mission />} />
        <Route path="/service-algorithm" element={<ServiceAlgorithm />} />
        <Route path="/fin-activities" element={<FinActivities />} />
        <Route path="/services-list" element={<ServicesListPage />} />
        <Route path="/history" element={<History />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/available-places" element={<AvailablePlaces />} />
        <Route path="/internal-rules" element={<InternalRules />} />
        <Route path="/structure" element={<Structure />} />
        <Route path="/rating" element={<Rating />} />
        <Route path="/services-description" element={<ServicesDescription />} />
        <Route path="/commercial-tariffs" element={<CommercialTariffs />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/donation" element={<Donation />} />
        <Route path="/vacancies" element={<Vacancies />} />
        <Route path="/social-service-form" element={<SocialServiceForm />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/achievements/:id" element={<AchievementDetail />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/"
          element={
            <Navigate to="/main" replace />
          }
        />

        {/* Catch-all: any unknown path → branded 404 page */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastContainer
        position="bottom-right"
        autoClose={3500}
        newestOnTop
        theme="light"
      />
    </AuthContext.Provider>
  );
}

export default App;
