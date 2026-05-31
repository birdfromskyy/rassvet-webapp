import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

const api = axios.create({
	baseURL: API_URL,
	withCredentials: true,
	headers: {
		'Content-Type': 'application/json',
	},
})

// Redirect to /login on 401, but NOT for:
// - the initial session check (getMe on app mount) — unauthenticated users on public pages
//   would otherwise get stuck in a redirect loop
// - requests already originating from /login (prevents infinite reload)
api.interceptors.response.use(
	response => response,
	error => {
		const isInitialCheck = error.config?._isInitialCheck === true
		const alreadyOnLogin = window.location.pathname === '/login'
		if (error.response?.status === 401 && !isInitialCheck && !alreadyOnLogin) {
			window.location.href = '/login'
		}
		return Promise.reject(error)
	}
)

export default api
