import api from './api'

const reviewService = {
	getPublishedReviews: async () => {
		const response = await api.get('/reviews')
		return response.data
	},

	createReview: async reviewData => {
		const response = await api.post('/reviews', reviewData)
		return response.data
	},

	getMyReviews: async () => {
		const response = await api.get('/my-reviews')
		return response.data
	},

	// Admin endpoints
	getAllReviews: async (status = '') => {
		const params = status ? `?status=${status}` : ''
		const response = await api.get(`/admin/reviews${params}`)
		return response.data
	},

	getPendingReviews: async () => {
		const response = await api.get('/admin/reviews/pending')
		return response.data
	},

	updateReview: async (id, data) => {
		const response = await api.put(`/admin/reviews/${id}`, data)
		return response.data
	},

	deleteReview: async id => {
		const response = await api.delete(`/admin/reviews/${id}`)
		return response.data
	},

	approveReview: async id => {
		const response = await api.put(`/admin/reviews/${id}/approve`)
		return response.data
	},

	rejectReview: async id => {
		const response = await api.put(`/admin/reviews/${id}/reject`)
		return response.data
	},
}

export default reviewService
