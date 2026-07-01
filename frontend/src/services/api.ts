import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.100.50:3000', // Mude para o IP do seu servidor/máquina virtual se necessário
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@SistemaBar:token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
