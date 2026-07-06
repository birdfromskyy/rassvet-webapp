import api from './api'
import { cachedGet, invalidate } from './cmsCache'

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
    timeout: 0,
  })
  return res.data.url
}

// ── Employees (public list only — admin management via Teachers) ───────────

export const employeeService = {
  getAll: () => api.get('/employees').then(r => r.data),
}

// ── CMS Files (docs / rules / rating) ─────────────────────────────────────

export const cmsFileService = {
  getBySection: (section) =>
    cachedGet(`cms-files:${section}`, () =>
      api.get('/cms-files', { params: { section } }).then(r => r.data)
    ),
  getAllAdmin: (section) => {
    const params = section ? { section } : {}
    return api.get('/admin/cms-files', { params }).then(r => r.data)
  },
  create: (data) => api.post('/admin/cms-files', data).then(r => { invalidate('cms-files'); return r.data }),
  update: (id, data) => api.put(`/admin/cms-files/${id}`, data).then(r => { invalidate('cms-files'); return r.data }),
  delete: (id) => api.delete(`/admin/cms-files/${id}`).then(r => { invalidate('cms-files'); return r.data }),
}

// ── History ────────────────────────────────────────────────────────────────

export const historyService = {
  getAll: () => cachedGet('history', () => api.get('/history').then(r => r.data)),
  create: (data) => api.post('/admin/history', data).then(r => { invalidate('history'); return r.data }),
  update: (id, data) => api.put(`/admin/history/${id}`, data).then(r => { invalidate('history'); return r.data }),
  delete: (id) => api.delete(`/admin/history/${id}`).then(r => { invalidate('history'); return r.data }),
}

// ── Services (/services-list and /about_services) ─────────────────────────

export const serviceCmsService = {
  getAll: (type) =>
    cachedGet(`services:${type || ''}`, () =>
      api.get('/services', { params: type ? { type } : {} }).then(r => r.data)
    ),
  getAllAdmin: (type) => api.get('/admin/services', { params: type ? { type } : {} }).then(r => r.data),
  create: (data) => api.post('/admin/services', data).then(r => { invalidate('services'); return r.data }),
  update: (id, data) => api.put(`/admin/services/${id}`, data).then(r => { invalidate('services'); return r.data }),
  delete: (id) => api.delete(`/admin/services/${id}`).then(r => { invalidate('services'); return r.data }),
}

// ── Fin Zones (/fin_activities) ────────────────────────────────────────────

export const finZoneService = {
  getAll: () => cachedGet('fin-zones', () => api.get('/fin-zones').then(r => r.data)),
  getAllAdmin: () => api.get('/admin/fin-zones').then(r => r.data),
  create: (data) => api.post('/admin/fin-zones', data).then(r => { invalidate('fin-zones'); return r.data }),
  update: (id, data) => api.put(`/admin/fin-zones/${id}`, data).then(r => { invalidate('fin-zones'); return r.data }),
  delete: (id) => api.delete(`/admin/fin-zones/${id}`).then(r => { invalidate('fin-zones'); return r.data }),
}

// ── Site Settings ──────────────────────────────────────────────────────────

// Site settings are static config read by the header/footer on every page
// mount (was ~170 requests/session). Cached like the rest of the CMS; any
// admin edit invalidates it so changes still show after saving.
export const siteSettingService = {
  getAll: () => cachedGet('site-settings', () => api.get('/site-settings').then(r => r.data)),
  getByKey: (key) => api.get(`/site-settings/${key}`).then(r => r.data),
  upsert: (key, value) =>
    api.put('/admin/site-settings', { key, value }).then(r => { invalidate('site-settings'); return r.data }),
  upsertBulk: (data) =>
    api.put('/admin/site-settings/bulk', data).then(r => { invalidate('site-settings'); return r.data }),
}
