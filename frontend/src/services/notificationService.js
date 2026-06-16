import api from './api'

const notificationService = {
  getAll: () => api.get('/notifications').then(r => r.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then(r => r.data),
  markOneRead: (id) => api.put(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.put('/notifications/read-all').then(r => r.data),
  deleteOne: (id) => api.delete(`/notifications/${id}`).then(r => r.data),
  deleteAll: () => api.delete('/notifications').then(r => r.data),
}

export default notificationService
