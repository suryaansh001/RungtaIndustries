import api from '../api';

export const coilService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/coils', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/coils/${id}`).then((r) => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/coils', body).then((r) => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.put(`/coils/${id}`, body).then((r) => r.data.data),

  updateStage: (id: string, stage: string, remark?: string) =>
    api.patch(`/coils/${id}/stage`, { stage, remark }).then((r) => r.data.data),
};
