import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

const api = axios.create({
	baseURL: API_URL,
	withCredentials: true,
	headers: { 'Content-Type': 'application/json' },
})

// Track whether a refresh is already in flight so concurrent 401s
// don't each trigger their own refresh — they queue and retry together.
let isRefreshing = false
let refreshQueue = [] // [{ resolve, reject }]

const processQueue = (error) => {
	refreshQueue.forEach(p => error ? p.reject(error) : p.resolve())
	refreshQueue = []
}

api.interceptors.response.use(
	response => response,
	async error => {
		const original = error.config

		const isInitialCheck = original?._isInitialCheck === true
		const isRefreshCall  = original?.url?.includes('/refresh')
		const alreadyRetried = original?._retried === true

		// Skip: not a 401, already retried, or the refresh call itself.
		// isInitialCheck does NOT skip refresh — it only suppresses the /login redirect.
		if (
			error.response?.status !== 401 ||
			isRefreshCall ||
			alreadyRetried
		) {
			if (error.response?.status === 401 && !isRefreshCall && !isInitialCheck) {
				window.location.href = '/login'
			}
			return Promise.reject(error)
		}

		// If a refresh is already running, queue this request.
		if (isRefreshing) {
			return new Promise((resolve, reject) => {
				refreshQueue.push({ resolve, reject })
			}).then(() => {
				original._retried = true
				return api(original)
			}).catch(() => {
				if (!isInitialCheck) window.location.href = '/login'
				return Promise.reject(error)
			})
		}

		isRefreshing = true
		original._retried = true

		try {
			await axios.post(`${API_URL}/refresh`, {}, { withCredentials: true })
			processQueue(null)
			return api(original)
		} catch {
			processQueue(new Error('refresh_failed'))
			if (!isInitialCheck) window.location.href = '/login'
			return Promise.reject(error)
		} finally {
			isRefreshing = false
		}
	}
)

export default api
