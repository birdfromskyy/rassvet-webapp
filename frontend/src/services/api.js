import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

const api = axios.create({
	baseURL: API_URL,
	withCredentials: true,
	headers: { 'Content-Type': 'application/json' },
	timeout: 15000,
})

// WebKit browsers (Safari on macOS/iOS, and in-app WebViews like MAX)
// aggressively cache GET responses and can serve a stale one — which
// shows up as "data didn't load" (e.g. empty user/schedule lists). A
// unique `_ts` param per GET makes each URL distinct so no cache can
// match. It's CORS-safe (no custom headers) and the backend ignores
// unknown query params.
api.interceptors.request.use(config => {
	if ((config.method || 'get').toLowerCase() === 'get') {
		config.params = { ...(config.params || {}), _ts: Date.now() }
	}
	return config
})

// --- Network-failure telemetry -------------------------------------------
// Requests that never reach the server (timeout / dropped connection) are
// invisible in backend logs, so we can't see WHO/WHAT is failing when users
// report "the site doesn't load". Report those failures (throttled + batched)
// through the existing client-error channel so the backend logs them with the
// caller's IP + User-Agent. Best-effort: if the network is fully down the
// report can't send either, but intermittent failures get captured.
let netFailBuffer = []
let netFailTimer = null

const flushNetFails = () => {
	netFailTimer = null
	if (netFailBuffer.length === 0) return
	const batch = netFailBuffer
	netFailBuffer = []
	const summary = batch
		.slice(0, 8)
		.map(f => `${f.reason}:${f.method} ${f.url}`)
		.join(' | ')
	api
		.post('/client-error', {
			message: `[NET-FAIL x${batch.length}] ${summary}`.slice(0, 2000),
			url: window.location.href,
		}, { _netReport: true })
		.catch(() => {})
}

const reportNetFail = (config, reason) => {
	if (config?._netReport) return // never report the reporter's own failure
	const method = (config?.method || 'GET').toUpperCase()
	const url = (config?.url || '').split('?')[0]
	netFailBuffer.push({ reason, method, url })
	if (netFailBuffer.length > 50) netFailBuffer.shift()
	// Throttle: at most one batched report per 15s so we don't add to the flood.
	if (!netFailTimer) netFailTimer = setTimeout(flushNetFails, 15000)
}

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

		// No HTTP response at all = the request died in the network
		// (timeout / connection dropped) — the invisible-in-logs case.
		if (!error.response) {
			reportNetFail(original, error.code === 'ECONNABORTED' ? 'timeout' : 'network')
		}

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
			// First attempt
			try {
				await axios.post(`${API_URL}/refresh`, {}, { withCredentials: true, timeout: 5000 })
			} catch (firstErr) {
				// Retry once after a short delay — handles transient cookie/Redis hiccups
				if (firstErr.response?.status === 401) {
					await new Promise(r => setTimeout(r, 400))
					await axios.post(`${API_URL}/refresh`, {}, { withCredentials: true, timeout: 5000 })
				} else {
					throw firstErr
				}
			}
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
