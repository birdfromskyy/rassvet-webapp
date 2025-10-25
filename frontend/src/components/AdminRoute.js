import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

const AdminRoute = ({ user }) => {
	return user?.role === 'admin' ? <Outlet /> : <Navigate to='/dashboard' />
}

export default AdminRoute
