'use client';

import axios from 'axios';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

export const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVER_API_URL || 'http://localhost:8083',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

const flushQueue = (token: string | null) => {
  queue.forEach((cb) => cb(token));
  queue = [];
};

function clearAndRedirect() {
  tokenStorage.removeToken();
  tokenStorage.removeRefreshToken();
  window.location.href = '/login';
}

axiosInstance.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      clearAndRedirect();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // While a refresh is in flight, queue this request and retry once a new token lands.
      return new Promise((resolve, reject) => {
        queue.push((token) => {
          if (!token) return reject(error);
          original.headers.Authorization = `Bearer ${token}`;
          original._retry = true;
          resolve(axiosInstance(original));
        });
      });
    }

    isRefreshing = true;
    original._retry = true;
    try {
      // Use a plain axios call (no interceptors) to avoid an infinite refresh loop.
      const res = await axios.post(
        `${axiosInstance.defaults.baseURL}/api/auth/refresh`,
        { refreshToken }
      );
      const newToken = res.data.data.token;
      tokenStorage.setToken(newToken);
      tokenStorage.setRefreshToken(res.data.data.refreshToken);
      flushQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(original);
    } catch (e) {
      flushQueue(null);
      clearAndRedirect();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
