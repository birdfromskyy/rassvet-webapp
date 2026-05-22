import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Home from './pages/Home';

import ServicesListPage from "./pages/ServicesListPage";
import Mission from './pages/Mission'
import History from './pages/History'
import Docs from './pages/Docs'
import Employees from './pages/Employees'
import AvailablePlaces from './pages/AvailablePlaces'
import InternalRules from './pages/InternalRules'
import Structure from './pages/Structure'
import Rating from './pages/Rating'
import ServicesDescription from './pages/ServicesDescription'
import Contacts from './pages/Contacts'
import Donation from './pages/Donation'
import SocialServiceForm from './pages/SocialServiceForm'

import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import VerifyEmail from './pages/VerifyEmail/VerifyEmail'
import Dashboard from './pages/Dashboard/Dashboard'
import Reviews from './pages/Reviews/Reviews'
import CreateReview from './pages/CreateReview/CreateReview'
import AdminReviews from './pages/AdminReviews'
import PendingReviews from './pages/PendingReviews'
import News from './pages/News/News'
import NewsDetail from './pages/NewsDetail/NewsDetail'
import AdminNews from './pages/AdminNews'
import AdminNewsPreview from './pages/AdminNewsPreview'
import AdminSchedulePanel from './pages/AdminSchedulePanel'
import AdminSubjects from './pages/AdminSubjects'
import AdminTeachers from './pages/AdminTeachers'
import AdminStudents from './pages/AdminStudents'
import AdminRooms from './pages/AdminRooms'
import AdminAssignments from './pages/AdminAssignments'
import AdminSchedule from './pages/AdminSchedule'
import AdminGroupLessons from './pages/AdminGroupLessons'
import AdminUsers from './pages/AdminUsers'
import AdminReports from './pages/AdminReports'
import AdminCmsFiles from './pages/AdminCmsFiles'
import AdminHistory from './pages/AdminHistory'
import AdminFinZones from './pages/AdminFinZones'
import AdminServices from './pages/AdminServices'
import AdminSiteSettings from './pages/AdminSiteSettings'
import AdminCMSPanel from './pages/AdminCMSPanel'
import ChildSchedule from './pages/ChildSchedule'
import TeacherSchedule from './pages/TeacherSchedule'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'
import ForgotPassword from './pages/ForgotPassword/ForgotPassword'
import Profile from './pages/Profile/Profile'
import FinActivities from './pages/FinActivities';

function App() {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [user, setUser] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const token = localStorage.getItem('token')
		const userData = localStorage.getItem('user')

		if (token && userData) {
			setIsAuthenticated(true)
			setUser(JSON.parse(userData))
		}
		setLoading(false)
	}, [])

	const handleLogin = (token, userData) => {
		localStorage.setItem('token', token)
		localStorage.setItem('user', JSON.stringify(userData))
		setIsAuthenticated(true)
		setUser(userData)
	}

	const handleLogout = () => {
		localStorage.removeItem('token')
		localStorage.removeItem('user')
		setIsAuthenticated(false)
		setUser(null)
	}

	// Добавьте эту функцию для обновления пользователя
	const handleUpdateUser = updatedUser => {
		// Если email изменился и не верифицирован - НЕ обновляем user
		if (
			updatedUser.is_verified === false &&
			updatedUser.email !== user?.email
		) {
			// Пользователь будет выведен из системы на фронтенде
			return
		}

		setUser(updatedUser)
		localStorage.setItem('user', JSON.stringify(updatedUser))
	}

	if (loading) {
		return <div>Loading...</div>
	}

	return (
		<>
			<Routes>
				<Route path='/forgot-password' element={<ForgotPassword />} />
				<Route
					path='/profile'
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
					path='/login'
					element={
						!isAuthenticated ? (
							<Login onLogin={handleLogin} />
						) : (
							<Navigate to='/dashboard' />
						)
					}
				/>
				<Route
					path='/register'
					element={
						!isAuthenticated ? <Register /> : <Navigate to='/dashboard' />
					}
				/>
				<Route
					path='/verify-email'
					element={
						!isAuthenticated ? <VerifyEmail /> : <Navigate to='/dashboard' />
					}
				/>

				{/* Публичные маршруты для новостей */}
				<Route path='/news' element={<News />} />
				<Route path='/news/:slug' element={<NewsDetail />} />

				<Route element={<PrivateRoute isAuthenticated={isAuthenticated} />}>
					<Route
						path='/dashboard'
						element={<Dashboard user={user} onLogout={handleLogout} />}
					/>
					<Route path='/reviews' element={<Reviews user={user} />} />
					<Route
						path='/create-review'
						element={user?.role === 'teacher' ? <Navigate to='/reviews' /> : <CreateReview />}
					/>
					<Route
						path='/my-schedule'
						element={user?.role === 'teacher' ? <TeacherSchedule user={user} /> : <ChildSchedule user={user} />}
					/>
					<Route path='/teacher/schedule' element={<TeacherSchedule user={user} />} />

					<Route element={<AdminRoute user={user} />}>
						<Route path='/admin/reviews' element={<AdminReviews />} />
						<Route path='/admin/pending-reviews' element={<PendingReviews />} />
						<Route path='/admin/news' element={<AdminNews />} />
						<Route path='/admin/news/:id/preview' element={<AdminNewsPreview />} />
						<Route path='/admin/schedule' element={<AdminSchedulePanel />} />
						<Route path='/admin/schedule/subjects' element={<AdminSubjects />} />
						<Route path='/admin/schedule/teachers' element={<AdminTeachers />} />
						<Route path='/admin/schedule/students' element={<AdminStudents />} />
						<Route path='/admin/schedule/rooms' element={<AdminRooms />} />
						<Route path='/admin/schedule/assignments' element={<AdminAssignments />} />
						<Route path='/admin/schedule/group-lessons' element={<AdminGroupLessons />} />
						<Route path='/admin/schedule/weekly' element={<AdminSchedule />} />
						<Route path='/admin/schedule/reports' element={<AdminReports />} />
						<Route path='/admin/users' element={<AdminUsers />} />

						{/* CMS hub */}
						<Route path='/admin/cms' element={<AdminCMSPanel />} />

						{/* CMS routes */}
						<Route path='/admin/cms/news' element={<AdminNews />} />
						<Route path='/admin/cms/docs' element={<AdminCmsFiles section="docs" title="Документы" />} />
						<Route path='/admin/cms/rules' element={<AdminCmsFiles section="rules" title="Правила внутреннего распорядка" />} />
						<Route path='/admin/cms/rating' element={<AdminCmsFiles section="rating" title="Независимая оценка качества" />} />
						<Route path='/admin/cms/history' element={<AdminHistory />} />
						<Route path='/admin/cms/fin-zones' element={<AdminFinZones />} />
						<Route path='/admin/cms/services' element={<AdminServices />} />
						<Route path='/admin/cms/settings' element={<AdminSiteSettings />} />
					</Route>
				</Route>

				<Route path='/main' element={<Home />} />
<Route path='/mission' element={<Mission />} />
<Route path='/fin-activities' element={<FinActivities />} />
<Route path='/services-list' element={<ServicesListPage />} />
<Route path='/history' element={<History />} />
<Route path='/docs' element={<Docs />} />
<Route path='/employees' element={<Employees />} />
<Route path='/available-places' element={<AvailablePlaces />} />
<Route path='/internal-rules' element={<InternalRules />} />
<Route path='/structure' element={<Structure />} />
<Route path='/rating' element={<Rating />} />
<Route path='/services-description' element={<ServicesDescription />} />
<Route path='/contacts' element={<Contacts />} />
<Route path='/donation' element={<Donation />} />
<Route path='/social-service-form' element={<SocialServiceForm />} />

				<Route path='/' element={<Navigate to='/dashboard' />} />
			</Routes>
			<ToastContainer position='top-right' />
		</>
	)
}

export default App
