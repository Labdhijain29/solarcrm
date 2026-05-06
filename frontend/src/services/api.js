import axios from 'axios'
import { getPublicFileUrl } from '../utils/files'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export { getPublicFileUrl }

const isFormData = (data) => typeof FormData !== 'undefined' && data instanceof FormData
const formDataConfig = (data) => (isFormData(data) ? { headers: {} } : undefined)

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
    if (isFormData(config.data)) {
      if (typeof config.headers?.delete === 'function') {
        config.headers.delete('Content-Type')
      } else {
        delete config.headers['Content-Type']
        delete config.headers['content-type']
      }
    }
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
    formDataConfig(data)
  ),
  uploadRegistrationDocument: (id, data) => api.post(
    `/auth/register/${id}/document`,
    data,
    formDataConfig(data)
  ),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  logout: () => api.post('/auth/logout'),
}

// ─── LEADS ─────────────────────────────────────────────────
export const leadsAPI = {
  getAll: (params = {}) => api.get('/leads', { params: { limit: 1000, ...params } }),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data, formDataConfig(data)),
  update: (id, data) => api.put(`/leads/${id}`, data, formDataConfig(data)),
  approve: (id, data) => api.post(`/leads/${id}/approve`, data, formDataConfig(data)),
  reject: (id, data) => api.post(`/leads/${id}/reject`, data),
  transfer: (id, data) => api.post(`/leads/${id}/transfer`, data),
  addNote: (id, note) => api.post(`/leads/${id}/note`, { note }),
  delete: (id) => api.delete(`/leads/${id}`),
}

// ─── USERS ─────────────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  getAssignable: (params = {}) => api.get('/users/assignable', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  updateMe: (data) => api.put('/users/me', data),
  create: (data) => api.post(
    '/users',
    data,
    formDataConfig(data)
  ),
  update: (id, data) => api.put(`/users/${id}`, data, formDataConfig(data)),
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
  delete: async (id) => {
    try {
      return await api.delete(`/enquiries/${id}`)
    } catch (error) {
      const message = String(error.response?.data?.message || '').toLowerCase()
      if (error.response?.status === 404 || message.includes('route not found')) {
        return api.post(`/enquiries/${id}/delete`)
      }
      throw error
    }
  },
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
  update: (id, data) => api.patch(`/dispatch/${id}`, data),
  approve: (id) => api.post(`/dispatch/${id}/approve`),
  updateInstallationStatus: (id, status) => api.patch(`/dispatch/${id}/installation-status`, { status }),
}

export const settingsAPI = {
  getUpload: () => api.get('/settings/upload'),
  updateUpload: (data) => api.put('/settings/upload', data),
}

export default api
