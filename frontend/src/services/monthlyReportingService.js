import api from './api';

const monthPath = (student, month) => `/admin/students/${student}/service-months/${month}-01`;
const get = async (path, key, config) => (await api.get(path, config)).data[key];
const paged = async (path, key, signal) => {
  const result = [];
  for (let offset = 0; offset <= 1000000; offset += 100) {
    const rows = await get(path, key, { signal, params: { limit: 100, offset } });
    result.push(...rows);
    if (rows.length < 100) return result;
  }
  throw new Error('Слишком много записей');
};

const reporting = {
  students: async signal => {
    const lists = await Promise.all([false, true].map(archived => get('/admin/students', 'students', { signal, params: { archived } })));
    return [...new Map(lists.flat().map(row => [row.id, row])).values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
  },
  student: (id, signal) => get(`/admin/students/${id}`, 'student', { signal }),
  identity: async (id, body) => (await api.put(`/admin/students/${id}/identity`, body)).data.student,
  representatives: signal => paged('/admin/legal-representatives', 'representatives', signal),
  links: (id, signal) => paged(`/admin/students/${id}/legal-representatives`, 'links', signal),
  saveRepresentative: async (id, body) => (await (id ? api.put(`/admin/legal-representatives/${id}`, body) : api.post('/admin/legal-representatives', body))).data.representative,
  saveLink: async (student, rep, body) => (await api.put(`/admin/students/${student}/legal-representatives/${rep}`, body)).data.link,
  settings: signal => get('/admin/social-service-report-settings', 'settings', { signal }),
  saveSettings: async body => (await api.put('/admin/social-service-report-settings', body)).data.settings,
  directory: signal => get('/admin/social-services', 'services', { signal, params: { include_inactive: true } }),
  saveService: async (id, body) => (await (id ? api.put(`/admin/social-services/${id}`, body) : api.post('/admin/social-services', body))).data.service,
  importDirectory: () => api.post('/admin/social-services/initial-directory'),
  month: async (id, month, signal) => {
    try { return await get(monthPath(id, month), 'month', { signal }); }
    catch (error) { if (error.response?.status === 404) return null; throw error; }
  },
  legacy: async (id, signal) => {
    try { return (await get(`/admin/students/${id}/social-services`, 'services', { signal })) || []; }
    catch (error) {
      if (error.response?.status === 409 && error.response?.data?.code === 'monthly_reporting_required') return [];
      throw error;
    }
  },
  create: async (id, month, body) => (await api.post(monthPath(id, month), body)).data.month,
  save: async (id, month, body) => (await api.put(monthPath(id, month), body)).data.month,
  transition: async (id, month, action, revision) => (await api.post(`${monthPath(id, month)}/${action}`, { revision })).data.month,
};
export default reporting;
