import api from './api'

const awardService = {
  getPublic: () => api.get('/awards').then(r => r.data),
  adminGetAll: () => api.get('/admin/awards').then(r => r.data),
  adminCreate: (data) => api.post('/admin/awards', data).then(r => r.data),
  adminUpdate: (id, data) => api.put(`/admin/awards/${id}`, data).then(r => r.data),
  adminDelete: (id) => api.delete(`/admin/awards/${id}`).then(r => r.data),
}

export default awardService
