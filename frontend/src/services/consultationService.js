import api from './api'

const consultationService = {
  // Guest submit (no token needed)
  createGuest: (data) =>
    api.post('/consultations', data).then(r => r.data),

  // Authenticated user submit
  createAuth: (data) =>
    api.post('/consultations/auth', data).then(r => r.data),

  // Admin
  adminList: () => api.get('/admin/consultations').then(r => r.data),
  adminUpdate: (id, data) => api.put(`/admin/consultations/${id}`, data).then(r => r.data),
  adminAnonymize: (id) => api.post(`/admin/consultations/${id}/anonymize`).then(r => r.data),
  adminDelete: (id) => api.delete(`/admin/consultations/${id}`).then(r => r.data),
}

export default consultationService
