import api from './api';

const socialServiceReportService = {
  getDirectory: async (includeInactive = false) => {
    const response = await api.get('/admin/social-services', { params: includeInactive ? { include_inactive: true } : {} });
    return response.data.services || [];
  },
	importInitialDirectory: async () => {
		const response = await api.post('/admin/social-services/initial-directory');
		return response.data.created || 0;
	},
  createDirectoryItem: async data => {
    const response = await api.post('/admin/social-services', data);
    return response.data.service;
  },
  updateDirectoryItem: async (id, data) => {
    const response = await api.put(`/admin/social-services/${id}`, data);
    return response.data.service;
  },
  deleteDirectoryItem: async id => api.delete(`/admin/social-services/${id}`),
  getStudentServices: async studentId => {
    const response = await api.get(`/admin/students/${studentId}/social-services`);
    return response.data.services || [];
  },
  selectStudentServices: async (studentId, socialServiceIds) => {
    const response = await api.put(`/admin/students/${studentId}/social-services`, { social_service_ids: socialServiceIds });
    return response.data.services || [];
  },
  updateStudentService: async (studentId, id, data) => {
    const response = await api.put(`/admin/students/${studentId}/social-services/${id}`, data);
    return response.data.service;
  },
  deleteStudentService: async (studentId, id) => api.delete(`/admin/students/${studentId}/social-services/${id}`),
};

export default socialServiceReportService;
