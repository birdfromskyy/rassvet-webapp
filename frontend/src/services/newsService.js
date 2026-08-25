import api from './api'
import { cachedGet, invalidate } from './cmsCache'

const fetchArticles = (params) =>
  cachedGet(`articles:list:${params.page || 1}:${params.limit}:${params.search || ''}`, () =>
    api.get('/articles', { params }).then(r => r.data)
  )

const newsService = {
  getPublishedArticles: async (params = {}) => {
    const { page = 1, limit = 9, search } = params
    const query = { page, limit }
    if (search) query.search = search
    return fetchArticles(query)
  },

  getLatestArticles: async (limit = 5) => {
    const data = await fetchArticles({ page: 1, limit })
    return data.articles || []
  },

  getPopularArticles: async (limit = 5) => {
    const data = await fetchArticles({ page: 1, limit })
    return data.articles || []
  },

  getArticleBySlug: async (slug) =>
    cachedGet(`articles:slug:${slug}`, () => api.get(`/articles/${slug}`).then(r => r.data)),

  getRelatedArticles: async (slug, limit = 3) => {
    const data = await fetchArticles({ page: 1, limit })
    return (data.articles || []).filter(a => a.slug !== slug)
  },

  // Admin methods
  getAllArticles: () => api.get('/admin/articles').then(r => r.data),
  getArticleById: (id) => api.get(`/admin/articles/${id}`).then(r => r.data),
  createArticle: (data) => api.post('/admin/articles', data).then(r => { invalidate('articles'); return r.data }),
  updateArticle: (id, data) => api.put(`/admin/articles/${id}`, data).then(r => { invalidate('articles'); return r.data }),
  setPublicationStatus: (id, status) => api.put(`/admin/articles/${id}/publication`, { status }).then(r => { invalidate('articles'); return r.data }),
  deleteArticle: (id) => api.delete(`/admin/articles/${id}`).then(r => { invalidate('articles'); return r.data }),
}

export default newsService
