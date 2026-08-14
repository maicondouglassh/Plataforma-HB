import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Interceptor para injetar o Token JWT em TODAS as requisições automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@PlataformaHB:token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});