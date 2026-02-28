import api from '../api';

export const dashboardService = {
  getDashboard: () => api.get('/reports/dashboard').then((r) => r.data.data),
  getSettings: () => api.get('/settings').then((r) => r.data.data),
  updateSettings: (body: Record<string, unknown>) => api.put('/settings', body).then((r) => r.data.data),
};
