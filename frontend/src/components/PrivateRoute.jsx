import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

const PrivateRoute = ({ isAuthenticated, children }) => {
	if (!isAuthenticated) {
		return <Navigate to='/login' />
	}

	// Если есть children (компонент передан напрямую), рендерим его
	// Иначе используем Outlet для вложенных маршрутов
	return children ? children : <Outlet />
}

export default PrivateRoute
