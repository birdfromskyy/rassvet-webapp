import api from './api'
import { getUploadUrl } from './cmsService'
import { cachedGet, invalidate } from './cmsCache'

export { getUploadUrl }

const achievementService = {
  getPublic: () => cachedGet('achievements', () => api.get('/achievements').then(r => r.data)),
  adminGetAll: () => api.get('/admin/achievements').then(r => r.data),
  adminCreate: (data) => api.post('/admin/achievements', data).then(r => { invalidate('achievements'); return r.data }),
  adminUpdate: (id, data) => api.put(`/admin/achievements/${id}`, data).then(r => { invalidate('achievements'); return r.data }),
  adminDelete: (id) => api.delete(`/admin/achievements/${id}`).then(r => { invalidate('achievements'); return r.data }),
}

export default achievementService
