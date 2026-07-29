import api from "./api";
import { cachedGet, invalidate } from "./cmsCache";

const commercialTariffService = {
  getAll: () =>
    cachedGet("commercial-tariffs", () =>
      api.get("/commercial-tariffs").then((response) => response.data)
    ),
  getAllAdmin: () =>
    api.get("/admin/commercial-tariffs").then((response) => response.data),
  create: (data) =>
    api.post("/admin/commercial-tariffs", data).then((response) => {
      invalidate("commercial-tariffs");
      return response.data;
    }),
  update: (id, data) =>
    api.put(`/admin/commercial-tariffs/${id}`, data).then((response) => {
      invalidate("commercial-tariffs");
      return response.data;
    }),
  delete: (id) =>
    api.delete(`/admin/commercial-tariffs/${id}`).then((response) => {
      invalidate("commercial-tariffs");
      return response.data;
    }),
  getReportRules: () =>
    api.get("/admin/report-tariff-rules").then((response) => response.data),
  previewReportTariff: (data) =>
    api.post("/admin/report-tariff-rules/preview", data).then((response) => response.data),
  createReportRule: (data) =>
    api.post("/admin/report-tariff-rules", data).then((response) => response.data),
  updateReportRule: (id, data) =>
    api.put(`/admin/report-tariff-rules/${id}`, data).then((response) => response.data),
  deleteReportRule: (id) =>
    api.delete(`/admin/report-tariff-rules/${id}`).then((response) => response.data),
};

export default commercialTariffService;
