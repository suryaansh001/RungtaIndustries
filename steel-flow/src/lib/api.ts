import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

type RetryableRequestConfig = {
  _retry?: boolean;
  headers?: Record<string, string>;
};

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

const flushPendingQueue = (token: string | null) => {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
};

const clearAuthStorage = () => {
  ['ric_token', 'ric_refresh', 'ric_user', 'ric_role', 'ric_username'].forEach((k) => localStorage.removeItem(k));
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ric_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config || {}) as RetryableRequestConfig;
    const status = error.response?.status;
    const refreshToken = localStorage.getItem('ric_refresh');
    const isRefreshCall = String(error.config?.url || '').includes('/auth/refresh');

    if (status !== 401 || originalRequest._retry || isRefreshCall || !refreshToken) {
      if (status === 401) {
        clearAuthStorage();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken });
      const newAccessToken = data?.data?.accessToken;
      const newRefreshToken = data?.data?.refreshToken;
      if (!newAccessToken) throw new Error('No access token in refresh response');

      localStorage.setItem('ric_token', newAccessToken);
      if (newRefreshToken) localStorage.setItem('ric_refresh', newRefreshToken);
      flushPendingQueue(newAccessToken);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      flushPendingQueue(null);
      clearAuthStorage();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
