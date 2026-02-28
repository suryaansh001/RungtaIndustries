import api from '../api';

export const partyService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/parties', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/parties/${id}`).then((r) => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/parties', body).then((r) => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.put(`/parties/${id}`, body).then((r) => r.data.data),

  remove: (id: string) =>
    api.delete(`/parties/${id}`).then((r) => r.data),
};
