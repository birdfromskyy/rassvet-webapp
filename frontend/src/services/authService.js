import api from './api'

const authService = {
	register: async userData => {
		const response = await api.post('/register', userData)
		return response.data
	},

	login: async credentials => {
		const response = await api.post('/login', credentials)
		return response.data
	},

	verifyEmail: async data => {
		const response = await api.post('/verify-email', data)
		return response.data
	},

	resendCode: async email => {
		const response = await api.post('/resend-code', { email })
		return response.data
	},

	logout: async () => {
		const response = await api.post('/logout')
		return response.data
	},

	getMe: async () => {
		const response = await api.get('/me')
		return response.data
	},
}

export default authService
