import api from './api'

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api'

export const SUPPORT_CATEGORIES = [
  { value: 'account',   label: 'Личный кабинет' },
  { value: 'documents', label: 'Документы' },
  { value: 'schedule',  label: 'Расписание занятий' },
  { value: 'site_error', label: 'Ошибка на сайте' },
  { value: 'other',     label: 'Другое' },
]

export const SUPPORT_CATEGORY_LABEL = Object.fromEntries(
  SUPPORT_CATEGORIES.map(c => [c.value, c.label])
)

export const SUPPORT_STATUS_LABEL = {
  open:        'Открыто',
  in_progress: 'В работе',
  closed:      'Закрыто',
}

export const SUPPORT_STATUS_COLOR = {
  open:        'warning',
  in_progress: 'info',
  closed:      'default',
}

const supportService = {
  // ── User ──────────────────────────────────────────────────────────────────

  listMyTickets: () =>
    api.get('/support/tickets').then(r => r.data),

  getMyTicket: (id) =>
    api.get(`/support/tickets/${id}`).then(r => r.data),

  createTicket: ({ subject, category, body, files = [] }) => {
    const form = new FormData()
    form.append('subject', subject)
    form.append('category', category)
    form.append('body', body)
    files.forEach(f => form.append('files', f))
    return api.post('/support/tickets', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    }).then(r => r.data)
  },

  replyToTicket: (id, { body, files = [] }) => {
    const form = new FormData()
    form.append('body', body)
    files.forEach(f => form.append('files', f))
    return api.post(`/support/tickets/${id}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    }).then(r => r.data)
  },

  closeMyTicket: (id) =>
    api.put(`/support/tickets/${id}/close`).then(r => r.data),

  fileUrl: (filename) => `${BASE}/support/files/${filename}`,

  // ── Admin ──────────────────────────────────────────────────────────────────

  adminListTickets: ({ status, category } = {}) => {
    const params = {}
    if (status)   params.status   = status
    if (category) params.category = category
    return api.get('/admin/support/tickets', { params }).then(r => r.data)
  },

  adminGetTicket: (id) =>
    api.get(`/admin/support/tickets/${id}`).then(r => r.data),

  adminReplyToTicket: (id, { body, files = [] }) => {
    const form = new FormData()
    form.append('body', body)
    files.forEach(f => form.append('files', f))
    return api.post(`/admin/support/tickets/${id}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    }).then(r => r.data)
  },

  adminUpdateStatus: (id, status) =>
    api.put(`/admin/support/tickets/${id}/status`, { status }).then(r => r.data),

  adminUnreadCount: () =>
    api.get('/admin/support/unread-count').then(r => r.data),
}

export default supportService
