import api from './api'
import { cachedGet, invalidate } from './cmsCache'

const vacancyService = {
  getPublic: () => cachedGet('vacancies', () => api.get('/vacancies').then(r => r.data)),
  adminGetAll: () => api.get('/admin/vacancies').then(r => r.data),
  adminCreate: (data) => api.post('/admin/vacancies', data).then(r => { invalidate('vacancies'); return r.data }),
  adminUpdate: (id, data) => api.put(`/admin/vacancies/${id}`, data).then(r => { invalidate('vacancies'); return r.data }),
  adminDelete: (id) => api.delete(`/admin/vacancies/${id}`).then(r => { invalidate('vacancies'); return r.data }),
}

export default vacancyService
