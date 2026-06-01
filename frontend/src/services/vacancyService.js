import api from './api'

const vacancyService = {
  getPublic: () => api.get('/vacancies').then(r => r.data),
  adminGetAll: () => api.get('/admin/vacancies').then(r => r.data),
  adminCreate: (data) => api.post('/admin/vacancies', data).then(r => r.data),
  adminUpdate: (id, data) => api.put(`/admin/vacancies/${id}`, data).then(r => r.data),
  adminDelete: (id) => api.delete(`/admin/vacancies/${id}`).then(r => r.data),
}

export default vacancyService
