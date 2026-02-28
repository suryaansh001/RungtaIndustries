import api from '../api';

export const transferService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/transfers', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/transfers/${id}`).then((r) => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/transfers', body).then((r) => r.data.data),
};
