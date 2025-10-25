import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'
import Reviews from './pages/Reviews'
import CreateReview from './pages/CreateReview'
import AdminReviews from './pages/AdminReviews'
import PendingReviews from './pages/PendingReviews'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'

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

	if (loading) {
		return <div>Loading...</div>
	}

	return (
		<>
			<Routes>
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

				<Route element={<PrivateRoute isAuthenticated={isAuthenticated} />}>
					<Route
						path='/dashboard'
						element={<Dashboard user={user} onLogout={handleLogout} />}
					/>
					<Route path='/reviews' element={<Reviews user={user} />} />
					<Route path='/create-review' element={<CreateReview />} />

					<Route element={<AdminRoute user={user} />}>
						<Route path='/admin/reviews' element={<AdminReviews />} />
						<Route path='/admin/pending-reviews' element={<PendingReviews />} />
					</Route>
				</Route>

				<Route path='/' element={<Navigate to='/dashboard' />} />
			</Routes>
			<ToastContainer position='top-right' />
		</>
	)
}

export default App
