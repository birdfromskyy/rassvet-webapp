import api from './api'

const newsService = {
	// Получить опубликованные статьи
	getPublishedArticles: async (params = {}) => {
		const queryString = new URLSearchParams(params).toString()
		const response = await api.get(
			`/articles${queryString ? `?${queryString}` : ''}`
		)
		return response.data
	},

	// Получить последние статьи
	getLatestArticles: async (limit = 5) => {
		const response = await api.get(`/articles/latest?limit=${limit}`)
		return response.data
	},

	// Получить популярные статьи
	getPopularArticles: async (limit = 5) => {
		const response = await api.get(`/articles/popular?limit=${limit}`)
		return response.data
	},

	// Получить статью по slug
	getArticleBySlug: async slug => {
		const response = await api.get(`/articles/${slug}`)
		return response.data
	},

	// Получить связанные статьи
	getRelatedArticles: async (slug, limit = 3) => {
		const response = await api.get(`/articles/${slug}/related?limit=${limit}`)
		return response.data
	},

	// Получить категории
	getCategories: async () => {
		const response = await api.get('/articles/categories')
		return response.data
	},
}

export default newsService
