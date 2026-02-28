import api from '../api';

export const transactionService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/transactions', { params }).then((r) => r.data),
};
