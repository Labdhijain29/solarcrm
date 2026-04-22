import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor: attach JWT ───────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('solar_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor: handle 401 ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('solar_token')
      localStorage.removeItem('solar_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ───────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  logout: () => api.post('/auth/logout'),
}

// ─── LEADS ─────────────────────────────────────────────────
export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  approve: (id, data) => api.post(`/leads/${id}/approve`, data),
  reject: (id, data) => api.post(`/leads/${id}/reject`, data),
  addNote: (id, note) => api.post(`/leads/${id}/note`, { note }),
  delete: (id) => api.delete(`/leads/${id}`),
}

// ─── USERS ─────────────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  approve: (id) => api.post(`/users/${id}/approve`),
  reject: (id) => api.post(`/users/${id}/reject`),
  getNotifications: () => api.get('/users/notifications'),
  markNotificationsRead: () => api.put('/users/notifications/read'),
}

// ─── ENQUIRIES ─────────────────────────────────────────────
export const enquiriesAPI = {
  getAll: (params) => api.get('/enquiries', { params }),
  create: (data) => api.post('/enquiries', data),
  convertToLead: (id) => api.post(`/enquiries/${id}/convert`),
  update: (id, data) => api.put(`/enquiries/${id}`, data),
}

// ─── DASHBOARD ─────────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: () => api.get('/dashboard/activity'),
}

export default api
