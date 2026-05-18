import api from './api'

const newsService = {
  getPublishedArticles: async (params = {}) => {
    const { page = 1, limit = 9, search, category } = params
    const query = { page, limit }
    if (search) query.search = search
    if (category) query.category = category

    const res = await api.get('/articles', { params: query })
    return res.data
  },

  getLatestArticles: async (limit = 5) => {
    const res = await api.get('/articles', { params: { page: 1, limit } })
    return res.data.articles || []
  },

  getPopularArticles: async (limit = 5) => {
    const res = await api.get('/articles', { params: { page: 1, limit } })
    return res.data.articles || []
  },

  getArticleBySlug: async (slug) => {
    const res = await api.get(`/articles/${slug}`)
    return res.data
  },

  getRelatedArticles: async (slug, limit = 3) => {
    const res = await api.get('/articles', { params: { page: 1, limit } })
    return (res.data.articles || []).filter(a => a.slug !== slug)
  },

  getCategories: async () => {
    const res = await api.get('/articles/categories')
    return res.data || []
  },

  // Admin methods
  getAllArticles: () => api.get('/admin/articles').then(r => r.data),
  getArticleById: (id) => api.get(`/admin/articles/${id}`).then(r => r.data),
  createArticle: (data) => api.post('/admin/articles', data).then(r => r.data),
  updateArticle: (id, data) => api.put(`/admin/articles/${id}`, data).then(r => r.data),
  deleteArticle: (id) => api.delete(`/admin/articles/${id}`).then(r => r.data),
}

export default newsService
