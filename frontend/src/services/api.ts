import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Injeta automaticamente o token JWT no cabeçalho Authorization
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@PlataformaHB:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});