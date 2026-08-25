import api from "./api";

const vkNotificationService = {
  getAll: () => api.get("/admin/vk-notification-recipients").then((response) => response.data),
  create: (data) => api.post("/admin/vk-notification-recipients", data).then((response) => response.data),
  update: (id, data) => api.put(`/admin/vk-notification-recipients/${id}`, data).then((response) => response.data),
  delete: (id) => api.delete(`/admin/vk-notification-recipients/${id}`).then((response) => response.data),
  sendTest: (id) => api.post(`/admin/vk-notification-recipients/${id}/test`).then((response) => response.data),
};

export default vkNotificationService;
