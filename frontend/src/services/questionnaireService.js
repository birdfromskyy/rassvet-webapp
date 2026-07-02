import api from './api'

const questionnaireService = {
  getMine: () => api.get('/questionnaire').then(r => r.data),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/questionnaire', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    }).then(r => r.data)
  },
  getFileUrl: () => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'
    return `${base}/questionnaire/file`
  },

  // Admin
  adminList: () => api.get('/admin/questionnaires').then(r => r.data),
  adminFileUrl: (id) => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'
    return `${base}/admin/questionnaires/${id}/file`
  },
  adminUpdateStatus: (id, status, adminNote = '') =>
    api.put(`/admin/questionnaires/${id}/status`, { status, admin_note: adminNote }).then(r => r.data),
  adminAnonymize: (id) => api.post(`/admin/questionnaires/${id}/anonymize`).then(r => r.data),
  adminDelete: (id) => api.delete(`/admin/questionnaires/${id}`).then(r => r.data),
}

export default questionnaireService
