import api from './api';

const staffEventsService = {
  list: async signal => (await api.get('/admin/staff-dates', { signal })).data,
  save: async (kind, id, body) => (await api.put(`/admin/staff-dates/${kind}/${id}`, body)).data.dates,
  recipients: async signal => (await api.get('/admin/staff-reminder-recipients', { signal })).data.recipients,
  configure: async (id, body) => (await api.put(`/admin/staff-reminder-recipients/${id}`, body)).data.preference,
};
export default staffEventsService;
