import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { isAdmin } from '../utils/roles'

const AdminRoute = ({ user }) => {
	return isAdmin(user?.role) ? <Outlet /> : <Navigate to='/dashboard' />
}

export default AdminRoute
