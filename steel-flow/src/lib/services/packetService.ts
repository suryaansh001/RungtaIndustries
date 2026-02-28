import api from '../api';

export const packetService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/packets', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/packets/${id}`).then((r) => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/packets', body).then((r) => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.put(`/packets/${id}`, body).then((r) => r.data.data),

  dispatch: (id: string) =>
    api.patch(`/packets/${id}/dispatch`).then((r) => r.data.data),
};
