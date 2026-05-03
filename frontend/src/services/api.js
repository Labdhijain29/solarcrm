import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const getApiBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_URL || '/api'
  if (/^https?:\/\//i.test(configuredBase)) return configuredBase.replace(/\/+$/, '')
  return new URL(configuredBase, window.location.origin).href.replace(/\/+$/, '')
}

export const getPublicFileUrl = (filePath) => {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath

  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  const apiBaseUrl = getApiBaseUrl()
  const publicBase = apiBaseUrl.replace(/\/api\/?$/i, '')

  return `${publicBase}${normalizedPath}`
}

const shouldRedirectToLogin = (error) => {
  if (error.response?.status !== 401) return false

  const requestUrl = String(error.config?.url || '')
  const isPublicAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register')
  const isAlreadyOnLoginPage = window.location.pathname === '/login'

  return !isPublicAuthRequest && !isAlreadyOnLoginPage
}

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
    if (shouldRedirectToLogin(error)) {
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
  register: (data) => api.post(
    '/auth/register',
    data,
    typeof FormData !== 'undefined' && data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined
  ),
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
  updateMe: (data) => api.put('/users/me', data),
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

// INVENTORY
export const productAPI = {
  getAll: (params) => api.get('/product', { params }),
  getStats: () => api.get('/product/stats'),
  create: (data) => api.post('/product', data),
  bulkAdd: (data) => api.post('/product/bulk', data),
  update: (id, data) => api.put(`/product/${id}`, data),
  delete: (id) => api.delete(`/product/${id}`),
}

// DISPATCH
export const dispatchAPI = {
  getAll: (params) => api.get('/dispatch', { params }),
  getByLead: (leadId) => api.get(`/dispatch/${leadId}`),
  create: (data) => api.post('/dispatch', data),
  approve: (id) => api.post(`/dispatch/${id}/approve`),
  updateInstallationStatus: (id, status) => api.patch(`/dispatch/${id}/installation-status`, { status }),
}

export default api
