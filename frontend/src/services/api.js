import { clearClientSession, isOldSessionRequest, trackSessionRequest } from '../utils/session'
import axios from 'axios'
import { getPublicFileUrl } from '../utils/files'
import { validationMessage } from '../utils/contactValidation'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export { getPublicFileUrl }

const isFormData = (data) => typeof FormData !== 'undefined' && data instanceof FormData
const formDataConfig = (data) => (isFormData(data) ? { headers: {} } : undefined)

export const serviceRequestsAPI = {
  getAll: params => api.get('/service-requests', { params }),
  getOne: id => api.get(`/service-requests/${id}`),
  getManagers: () => api.get('/service-requests/managers'),
  update: (id, data) => api.put(`/service-requests/${id}`, data),
  create: data => api.post('/service-requests', data, { ...formDataConfig(data), timeout: 120000 }),
  addActivity: (id, data) => api.post(`/service-requests/${id}/activity`, data, { ...formDataConfig(data), timeout: 120000 }),
  setStatus: (id, data) => api.put(`/service-requests/${id}/status`, data),
}

const officeIndependentPath = url => /\/(auth\/(me|login|logout|change-password)|users\/me|offices)\/?$/.test(String(url).split('?')[0])
const oldOfficeRequest = config => config?.officeAtRequest && config.officeAtRequest !== localStorage.getItem('solar_office')

// ─── Request interceptor: attach JWT ───────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('solar_token')
    if (token && !config.publicRequest) config.headers.Authorization = `Bearer ${token}`
    const selectedOffice = localStorage.getItem('solar_office')
    if (!config.publicRequest || config.sessionBound) trackSessionRequest(config)
    if (token && selectedOffice && !config.publicRequest && !officeIndependentPath(config.url)) { config.headers['X-Office-Id'] = selectedOffice; config.officeAtRequest = selectedOffice }
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
  (response) => {
    response.config.releaseSessionRequest?.()
    if (isOldSessionRequest(response.config) || oldOfficeRequest(response.config)) return Promise.reject(new axios.CanceledError('Session or office changed.'))
    return response
  },
  (error) => {
    error.config?.releaseSessionRequest?.()
    if (isOldSessionRequest(error.config) || oldOfficeRequest(error.config)) return Promise.reject(new axios.CanceledError('Session or office changed.'))
    const requestUrl = String(error.config?.url || '')
    if (/\/(leads|enquiries)(\/|$)/.test(requestUrl)) {
      const message = validationMessage(error.response?.data)
      if (message) error.response.data.message = message
    }
    if (error.response?.status === 401 && !error.config?.publicRequest) {
      clearClientSession()
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ───────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data, { publicRequest:true, sessionBound:true }),
  register: (data) => api.post(
    '/auth/register',
    data,
    { ...formDataConfig(data), publicRequest: true }
  ),
  uploadRegistrationDocument: (id, data) => api.post(
    `/auth/register/${id}/document`,
    data,
    formDataConfig(data)
  ),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  logout: token => api.post('/auth/logout', {}, { publicRequest:true, headers:token ? { Authorization:`Bearer ${token}` } : {} }),
}

// ─── LEADS ─────────────────────────────────────────────────
export const leadsAPI = {
  getPipeline: (params = {}) => api.get('/leads/pipeline', { params }),
  getAll: (params = {}) => api.get('/leads', { params: { limit: 1000, ...params } }),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data, formDataConfig(data)),
  update: (id, data) => api.put(`/leads/${id}`, data, formDataConfig(data)),
  approve: (id, data) => api.post(`/leads/${id}/approve`, data, formDataConfig(data)),
  reject: (id, data) => api.post(`/leads/${id}/reject`, data),
  transfer: (id, data) => api.post(`/leads/${id}/transfer`, data),
  reassign: (id, data) => api.post(`/leads/${id}/reassign`, data),
  addNote: (id, note) => api.post(`/leads/${id}/note`, { note }),
  setStatus: (id, data) => api.post(`/leads/${id}/status`, data),
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
  update: (id, data) => api.put(`/users/${id}`, data, { ...formDataConfig(data), timeout: 120000 }),
  delete: (id) => api.delete(`/users/${id}`),
  approve: (id) => api.post(`/users/${id}/approve`),
  reject: (id) => api.post(`/users/${id}/reject`),
  getNotifications: () => api.get('/users/notifications'),
  markNotificationsRead: () => api.put('/users/notifications/read'),
}

// ─── ENQUIRIES ─────────────────────────────────────────────
export const enquiriesAPI = {
  getAll: (params, config = {}) => api.get('/enquiries', { ...config, params }),
  getDueFollowUps: () => api.get('/enquiries/follow-ups/due'),
  addFollowUp: (id, data) => api.post(`/enquiries/${id}/follow-ups`, data),
  create: (data, publicRequest = false) => api.post('/enquiries', data, { publicRequest }),
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

export const officesAPI = {
  getPublic: () => api.get('/offices/public', { publicRequest: true }),
  getAll: () => api.get('/offices'),
  getOne: id => api.get(`/offices/${id}`),
  create: data => api.post('/offices', data),
  update: (id, data) => api.put(`/offices/${id}`, data),
}
