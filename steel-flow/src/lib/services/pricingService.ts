import api from '../api';

export const pricingService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/pricing', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/pricing/${id}`).then((r) => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/pricing', body).then((r) => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.put(`/pricing/${id}`, body).then((r) => r.data.data),

  remove: (id: string) =>
    api.delete(`/pricing/${id}`).then((r) => r.data),
};
