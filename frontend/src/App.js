import React, { useState, useEffect } from "react";
import authService from "./services/authService";
import { AuthContext } from "./contexts/AuthContext";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Home from "./pages/Home";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import ServicesListPage from "./pages/ServicesListPage";
import Mission from "./pages/Mission";
import History from "./pages/History";
import Docs from "./pages/Docs";
import Employees from "./pages/Employees";
import AvailablePlaces from "./pages/AvailablePlaces";
import InternalRules from "./pages/InternalRules";
import Structure from "./pages/Structure";
import Rating from "./pages/Rating";
import ServicesDescription from "./pages/ServicesDescription";
import Contacts from "./pages/Contacts";
import Donation from "./pages/Donation";
import SocialServiceForm from "./pages/SocialServiceForm";
import Awards from "./pages/Awards/Awards";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";
import Dashboard from "./pages/Dashboard/Dashboard";
import Reviews from "./pages/Reviews/Reviews";
import CreateReview from "./pages/CreateReview/CreateReview";
import AdminReviews from "./pages/AdminReviews";
import PendingReviews from "./pages/PendingReviews";
import News from "./pages/News/News";
import NewsDetail from "./pages/NewsDetail/NewsDetail";
import AdminNews from "./pages/AdminNews";
import AdminNewsPreview from "./pages/AdminNewsPreview";
import AdminSchedulePanel from "./pages/AdminSchedulePanel";
import AdminSubjects from "./pages/AdminSubjects";
import AdminTeachers from "./pages/AdminTeachers";
import AdminStudents from "./pages/AdminStudents";
import AdminRooms from "./pages/AdminRooms";
import AdminAssignments from "./pages/AdminAssignments";
import AdminSchedule from "./pages/AdminSchedule";
import AdminGroupLessons from "./pages/AdminGroupLessons";
import AdminUsers from "./pages/AdminUsers";
import AdminReports from "./pages/AdminReports";
import AdminCmsFiles from "./pages/AdminCmsFiles";
import AdminHistory from "./pages/AdminHistory";
import AdminFinZones from "./pages/AdminFinZones";
import AdminServices from "./pages/AdminServices";
import AdminSiteSettings from "./pages/AdminSiteSettings";
import AdminCMSPanel from "./pages/AdminCMSPanel/AdminCMSPanel";
import AdminDocuments from "./pages/AdminDocuments";
import AdminConsultations from "./pages/AdminConsultations";
import AdminAchievements from "./pages/AdminAchievements";
import AdminAwards from "./pages/AdminAwards";
import AdminShorts from "./pages/AdminShorts";
import AdminQuestionnaires from "./pages/AdminQuestionnaires";
import ChildSchedule from "./pages/ChildSchedule";
import TeacherSchedule from "./pages/TeacherSchedule";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Profile from "./pages/Profile/Profile";
import FinActivities from "./pages/FinActivities";
import ServiceAlgorithm from "./pages/ServiceAlgorithm/ServiceAlgorithm";
import Achievements from "./pages/Achievements/Achievements";
import ConsultationRequest from "./pages/ConsultationRequest/ConsultationRequest";
import AccessibilityPanel from "./components/AccessibilityPanel/AccessibilityPanel";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import AdminPrivacyPolicy from "./pages/AdminPrivacyPolicy/AdminPrivacyPolicy";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, handleLogin, handleLogout, handleUpdateUser }}>
      <AccessibilityPanel />
      <ScrollToTop />
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

        <Route element={<PrivateRoute isAuthenticated={isAuthenticated} />}>
          <Route
            path="/dashboard"
            element={<Dashboard user={user} onLogout={handleLogout} />}
          />
          <Route path="/reviews" element={<Reviews user={user} />} />
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
          <Route
            path="/my-schedule"
            element={
              user?.role === "teacher" ? (
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
            <Route path="/admin/schedule/rooms" element={<AdminRooms />} />
            <Route
              path="/admin/schedule/assignments"
              element={<AdminAssignments />}
            />
            <Route
              path="/admin/schedule/group-lessons"
              element={<AdminGroupLessons />}
            />
            <Route path="/admin/schedule/weekly" element={<AdminSchedule />} />
            <Route path="/admin/schedule/reports" element={<AdminReports />} />
            <Route path="/admin/users" element={<AdminUsers />} />

            {/* Documents review */}
            <Route path="/admin/documents" element={<AdminDocuments />} />

            {/* Consultations & Questionnaires */}
            <Route path="/admin/consultations" element={<AdminConsultations />} />
            <Route path="/admin/questionnaires" element={<AdminQuestionnaires />} />

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
            <Route path="/admin/cms/settings" element={<AdminSiteSettings />} />
            <Route path="/admin/cms/achievements" element={<AdminAchievements />} />
            <Route path="/admin/cms/awards" element={<AdminAwards />} />
            <Route path="/admin/cms/shorts" element={<AdminShorts />} />
            <Route path="/admin/cms/privacy" element={<AdminPrivacyPolicy />} />
          </Route>
        </Route>

<Route path="/consultation-request" element={<ConsultationRequest />} />
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
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/donation" element={<Donation />} />
        <Route path="/social-service-form" element={<SocialServiceForm />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/"
          element={
            <Navigate to="/main" replace />
          }
        />
      </Routes>
      <ToastContainer position="top-right" />
    </AuthContext.Provider>
  );
}

export default App;
