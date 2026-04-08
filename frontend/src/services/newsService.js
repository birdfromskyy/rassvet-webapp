import axios from 'axios'

const DIRECTUS_URL =
	process.env.REACT_APP_DIRECTUS_URL || 'http://localhost:8055'

const directus = axios.create({
	baseURL: DIRECTUS_URL,
})

const newsService = {
	// Получить опубликованные статьи с пагинацией
	getPublishedArticles: async (params = {}) => {
		const { page = 1, limit = 9, search, category } = params

		const filter = { status: { _eq: 'published' } }
		if (category) filter.category = { _eq: category }

		const queryParams = {
			filter: JSON.stringify(filter),
			sort: '-published_at,-date_created',
			limit,
			offset: (page - 1) * limit,
			fields:
				'id,title,slug,summary,category,author,published_at,date_created,view_count,featured_image,tags',
			meta: 'total_count,filter_count',
		}

		if (search) queryParams.search = search

		const response = await directus.get('/items/articles', {
			params: queryParams,
		})

		const totalCount = response.data.meta?.filter_count || 0

		return {
			articles: response.data.data || [],
			pagination: {
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				page,
				limit,
			},
		}
	},

	// Получить последние статьи
	getLatestArticles: async (limit = 5) => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({ status: { _eq: 'published' } }),
				sort: '-published_at,-date_created',
				limit,
				fields:
					'id,title,slug,summary,category,author,published_at,date_created,featured_image',
			},
		})
		return response.data.data || []
	},

	// Получить популярные статьи
	getPopularArticles: async (limit = 5) => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({ status: { _eq: 'published' } }),
				sort: '-view_count',
				limit,
				fields:
					'id,title,slug,summary,published_at,date_created,view_count,featured_image',
			},
		})
		return response.data.data || []
	},

	// Получить статью по slug
	getArticleBySlug: async slug => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({
					slug: { _eq: slug },
					status: { _eq: 'published' },
				}),
				limit: 1,
				fields: '*',
			},
		})
		const articles = response.data.data || []
		if (articles.length === 0) throw new Error('Article not found')
		return articles[0]
	},

	// Получить связанные статьи (по категории)
	getRelatedArticles: async (slug, limit = 3) => {
		// Сначала получаем текущую статью для категории
		const current = await newsService.getArticleBySlug(slug)

		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({
					status: { _eq: 'published' },
					slug: { _neq: slug },
					...(current.category && { category: { _eq: current.category } }),
				}),
				sort: '-published_at',
				limit,
				fields:
					'id,title,slug,summary,published_at,date_created,featured_image',
			},
		})
		return response.data.data || []
	},

	// Получить категории
	getCategories: async () => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({ status: { _eq: 'published' } }),
				groupBy: 'category',
				aggregate: JSON.stringify({ count: 'id' }),
			},
		})
		// Извлекаем уникальные категории
		const data = response.data.data || []
		return data.map(item => item.category).filter(Boolean)
	},

	// Получить URL изображения из Directus
	getImageUrl: imageId => {
		if (!imageId) return null
		return `${DIRECTUS_URL}/assets/${imageId}`
	},
}

export default newsService
