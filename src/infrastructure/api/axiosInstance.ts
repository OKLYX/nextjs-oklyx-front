'use client';

import axios from 'axios';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8083`;
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
};

export const axiosInstance = axios.create({
  baseURL: getApiUrl(),
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
