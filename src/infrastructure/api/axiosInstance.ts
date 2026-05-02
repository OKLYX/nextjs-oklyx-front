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

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
