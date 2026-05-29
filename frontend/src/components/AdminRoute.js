import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

const isAdminOrSuper = (role) => role === 'admin' || role === 'superadmin'

const AdminRoute = ({ user }) => {
	return isAdminOrSuper(user?.role) ? <Outlet /> : <Navigate to='/dashboard' />
}

export default AdminRoute
