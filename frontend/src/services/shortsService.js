import api from './api'
import { getUploadUrl } from './cmsService'

export { getUploadUrl }

const shortsService = {
  getPublic: () => api.get('/shorts').then(r => r.data),
  adminGetAll: () => api.get('/admin/shorts').then(r => r.data),
  adminCreate: (data) => api.post('/admin/shorts', data).then(r => r.data),
  adminUpdate: (id, data) => api.put(`/admin/shorts/${id}`, data).then(r => r.data),
  adminDelete: (id) => api.delete(`/admin/shorts/${id}`).then(r => r.data),
}

export default shortsService
