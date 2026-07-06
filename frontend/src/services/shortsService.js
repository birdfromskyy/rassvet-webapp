import api from './api'
import { getUploadUrl } from './cmsService'
import { cachedGet, invalidate } from './cmsCache'

export { getUploadUrl }

const shortsService = {
  getPublic: () => cachedGet('shorts', () => api.get('/shorts').then(r => r.data)),
  adminGetAll: () => api.get('/admin/shorts').then(r => r.data),
  adminCreate: (data) => api.post('/admin/shorts', data).then(r => { invalidate('shorts'); return r.data }),
  adminUpdate: (id, data) => api.put(`/admin/shorts/${id}`, data).then(r => { invalidate('shorts'); return r.data }),
  adminDelete: (id) => api.delete(`/admin/shorts/${id}`).then(r => { invalidate('shorts'); return r.data }),
}

export default shortsService
