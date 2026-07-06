import api from './api'
import { cachedGet, invalidate } from './cmsCache'

const awardService = {
  getPublic: () => cachedGet('awards', () => api.get('/awards').then(r => r.data)),
  adminGetAll: () => api.get('/admin/awards').then(r => r.data),
  adminCreate: (data) => api.post('/admin/awards', data).then(r => { invalidate('awards'); return r.data }),
  adminUpdate: (id, data) => api.put(`/admin/awards/${id}`, data).then(r => { invalidate('awards'); return r.data }),
  adminDelete: (id) => api.delete(`/admin/awards/${id}`).then(r => { invalidate('awards'); return r.data }),
}

export default awardService
