import api from './api'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

// Returns the full URL for an uploaded file path like "/uploads/abc.jpg"
export const getUploadUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  const base = API_BASE.replace('/api', '')
  return `${base}${path}`
}

// Upload a file and return the URL
export const uploadFile = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.url
}

// ── Employees ──────────────────────────────────────────────────────────────

export const employeeService = {
  getAll: () => api.get('/employees').then(r => r.data),
  getAllAdmin: () => api.get('/admin/employees').then(r => r.data),
  create: (data) => api.post('/admin/employees', data).then(r => r.data),
  update: (id, data) => api.put(`/admin/employees/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/admin/employees/${id}`).then(r => r.data),
}

// ── CMS Files (docs / rules / rating) ─────────────────────────────────────

export const cmsFileService = {
  getBySection: (section) => api.get('/cms-files', { params: { section } }).then(r => r.data),
  getAllAdmin: (section) => {
    const params = section ? { section } : {}
    return api.get('/admin/cms-files', { params }).then(r => r.data)
  },
  create: (data) => api.post('/admin/cms-files', data).then(r => r.data),
  update: (id, data) => api.put(`/admin/cms-files/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/admin/cms-files/${id}`).then(r => r.data),
}

// ── History ────────────────────────────────────────────────────────────────

export const historyService = {
  getAll: () => api.get('/history').then(r => r.data),
  create: (data) => api.post('/admin/history', data).then(r => r.data),
  update: (id, data) => api.put(`/admin/history/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/admin/history/${id}`).then(r => r.data),
}

// ── Services (/services-list and /about_services) ─────────────────────────

export const serviceCmsService = {
  getAll: (type) => api.get('/services', { params: type ? { type } : {} }).then(r => r.data),
  getAllAdmin: (type) => api.get('/admin/services', { params: type ? { type } : {} }).then(r => r.data),
  create: (data) => api.post('/admin/services', data).then(r => r.data),
  update: (id, data) => api.put(`/admin/services/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/admin/services/${id}`).then(r => r.data),
}

// ── Fin Zones (/fin_activities) ────────────────────────────────────────────

export const finZoneService = {
  getAll: () => api.get('/fin-zones').then(r => r.data),
  getAllAdmin: () => api.get('/admin/fin-zones').then(r => r.data),
  create: (data) => api.post('/admin/fin-zones', data).then(r => r.data),
  update: (id, data) => api.put(`/admin/fin-zones/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/admin/fin-zones/${id}`).then(r => r.data),
}

// ── Site Settings ──────────────────────────────────────────────────────────

export const siteSettingService = {
  getAll: () => api.get('/site-settings').then(r => r.data),
  getByKey: (key) => api.get(`/site-settings/${key}`).then(r => r.data),
  upsert: (key, value) => api.put('/admin/site-settings', { key, value }).then(r => r.data),
  upsertBulk: (data) => api.put('/admin/site-settings/bulk', data).then(r => r.data),
}
