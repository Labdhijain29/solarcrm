import { create } from 'zustand'
import { authAPI } from '../services/api'

// ─── AUTH STORE ─────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('solar_user') || 'null'),
  token: localStorage.getItem('solar_token') || null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authAPI.login({ email, password })
      localStorage.setItem('solar_token', data.token)
      localStorage.setItem('solar_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.token, loading: false })
      return data.user
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  logout: async () => {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('solar_token')
    localStorage.removeItem('solar_user')
    set({ user: null, token: null })
  },

  clearError: () => set({ error: null }),
}))

// ─── APP STORE (theme, sidebar, notifications) ──────────────
export const useAppStore = create((set, get) => ({
  theme: localStorage.getItem('solar_theme') || 'dark',
  sidebarOpen: false,
  notifications: [],
  unreadCount: 0,

  setTheme: (theme) => {
    localStorage.setItem('solar_theme', theme)
    document.documentElement.className = theme
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  }),
}))
