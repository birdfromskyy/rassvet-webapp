import axios from 'axios'

const DIRECTUS_URL =
	process.env.REACT_APP_DIRECTUS_URL || 'http://localhost:8055'

const directus = axios.create({
	baseURL: DIRECTUS_URL,
})

const ARTICLE_LIST_FIELDS =
	'id,title,slug,summary,category,published_at,date_created,featured_image,tags'

const ARTICLE_DETAIL_FIELDS =
	'id,status,date_created,date_updated,title,slug,summary,featured_image,published_at,category,tags,blocks.id,blocks.collection,blocks.item.id,blocks.item.text,blocks.item.image,blocks.item.image.id,blocks.item.image.filename_download,blocks.item.video_url,blocks.item.file,blocks.item.file.id,blocks.item.file.filename_download,blocks.item.title'

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
			fields: ARTICLE_LIST_FIELDS,
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
				fields: ARTICLE_LIST_FIELDS,
			},
		})
		return response.data.data || []
	},

	// Получить популярные статьи
	getPopularArticles: async (limit = 5) => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({ status: { _eq: 'published' } }),
				sort: '-date_created',
				limit,
				fields: ARTICLE_LIST_FIELDS,
			},
		})
		return response.data.data || []
	},

	// Получить статью по slug вместе с блоками
	getArticleBySlug: async slug => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({
					slug: { _eq: slug },
					status: { _eq: 'published' },
				}),
				limit: 1,
				fields: ARTICLE_DETAIL_FIELDS,
			},
		})

		const articles = response.data.data || []
		if (articles.length === 0) throw new Error('Article not found')

		return articles[0]
	},

	// Получить связанные статьи
	getRelatedArticles: async (slug, limit = 3) => {
		const current = await newsService.getArticleBySlug(slug)

		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({
					status: { _eq: 'published' },
					slug: { _neq: slug },
					...(current.category && { category: { _eq: current.category } }),
				}),
				sort: '-published_at,-date_created',
				limit,
				fields: ARTICLE_LIST_FIELDS,
			},
		})

		return response.data.data || []
	},

	// Получить категории
	getCategories: async () => {
		const response = await directus.get('/items/articles', {
			params: {
				filter: JSON.stringify({ status: { _eq: 'published' } }),
				fields: 'category',
				limit: -1,
			},
		})

		const data = response.data.data || []
		return [...new Set(data.map(item => item.category).filter(Boolean))]
	},

	// URL ассета Directus
	getAssetUrl: assetId => {
		if (!assetId) return null
		return `${DIRECTUS_URL}/assets/${assetId}`
	},

	getAssetDownloadUrl: assetId => {
		if (!assetId) return null
		return `${DIRECTUS_URL}/assets/${assetId}?download`
	},

	// Для обратной совместимости
	getImageUrl: imageId => {
		if (!imageId) return null
		return `${DIRECTUS_URL}/assets/${imageId}`
	},
}

export default newsService
