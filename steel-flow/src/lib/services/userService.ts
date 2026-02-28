import api from '../api';

export const userService = {
  getAll: () => api.get('/users').then((r) => r.data),

  create: (body: Record<string, unknown>) =>
    api.post('/users', body).then((r) => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.put(`/users/${id}`, body).then((r) => r.data.data),

  remove: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
};
