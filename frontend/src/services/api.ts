import axios from 'axios';

// Saat production build, frontend & backend di-serve dari server yang SAMA,
// jadi cukup gunakan path relatif '/api'.
// Saat development, React dev server (port 3000) proxy ke backend (port 5000).
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: kirim token di setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Products
export const productService = {
  getAll: () => api.get('/products'),
  getGrouped: () => api.get('/products/grouped'),
  getById: (id: number) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
  bulkUpdateQuantities: (updates: any[]) => api.put('/products/bulk/quantities', { updates }),
  createGroup: (data: any) => api.post('/products/groups', data),
  updateGroup: (id: number, data: any) => api.put(`/products/groups/${id}`, data),
};

// Containers
export const containerService = {
  getAll: (includeCustom = true) => api.get('/containers', { params: { includeCustom } }),
  getSystem: () => api.get('/containers/system'),
  getById: (id: number) => api.get(`/containers/${id}`),
  createCustom: (data: any) => api.post('/containers/custom', data),
  update: (id: number, data: any) => api.put(`/containers/${id}`, data),
  delete: (id: number) => api.delete(`/containers/${id}`),
};

// Layouts
export const layoutService = {
  getAll: (status?: string) => api.get('/layouts', { params: { status } }),
  getById: (id: number) => api.get(`/layouts/${id}`),
  create: (data: any) => api.post('/layouts', data),
  update: (id: number, data: any) => api.put(`/layouts/${id}`, data),
  delete: (id: number) => api.delete(`/layouts/${id}`),
  autoPack: (id: number) => api.post(`/layouts/${id}/auto-pack`),
  reset: (id: number) => api.post(`/layouts/${id}/reset`),
  getStats: (id: number) => api.get(`/layouts/${id}/stats`),
  addItem: (layoutId: number, data: any) => api.post(`/layouts/${layoutId}/items`, data),
  updateItem: (itemId: number, data: any) => api.put(`/layouts/items/${itemId}`, data),
  removeItem: (itemId: number) => api.delete(`/layouts/items/${itemId}`),
};

// Auth
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// Projects (Save / Auto-save / Load)
export const projectService = {
  save: (data: any) => api.post('/projects/save', data),
  getAll: () => api.get('/projects'),
  getById: (id: number) => api.get(`/projects/${id}`),
  delete: (id: number) => api.delete(`/projects/${id}`),
};

export default api;
