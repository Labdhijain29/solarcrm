import { create } from 'zustand'
import { authAPI } from '../services/api'

const getApiErrorMessage = (err, fallback = 'Request failed') => {
  const firstValidationError = err.response?.data?.errors?.[0]?.message
  return firstValidationError || err.response?.data?.message || err.message || fallback
}

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('solar_user') || 'null')
  } catch {
    return null
  }
}

const getStoredToken = () => localStorage.getItem('solar_token') || null

const clearStoredAuth = () => {
  localStorage.removeItem('solar_token')
  localStorage.removeItem('solar_user')
}

let hydrateAuthPromise = null

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  loading: false,
  error: null,
  initialized: false,
  checkingAuth: false,

  hydrateAuth: async () => {
    const token = getStoredToken()

    if (!token) {
      clearStoredAuth()
      set({
        user: null,
        token: null,
        error: null,
        initialized: true,
        checkingAuth: false,
      })
      return null
    }

    if (get().checkingAuth && hydrateAuthPromise) return hydrateAuthPromise

    set({
      checkingAuth: true,
      token,
      error: null,
    })

    hydrateAuthPromise = authAPI.getMe()
      .then(({ data }) => {
        const user = data.user
        localStorage.setItem('solar_user', JSON.stringify(user))
        set({
          user,
          token,
          loading: false,
          error: null,
          initialized: true,
          checkingAuth: false,
        })
        return user
      })
      .catch((err) => {
        const unauthorized = err.response?.status === 401
        if (unauthorized) clearStoredAuth()

        set({
          user: null,
          token: unauthorized ? null : token,
          loading: false,
          error: unauthorized ? null : getApiErrorMessage(err, 'Unable to verify your session.'),
          initialized: true,
          checkingAuth: false,
        })

        return null
      })
      .finally(() => {
        hydrateAuthPromise = null
      })

    return hydrateAuthPromise
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authAPI.login({ email, password })
      localStorage.setItem('solar_token', data.token)
      localStorage.setItem('solar_user', JSON.stringify(data.user))
      set({
        user: data.user,
        token: data.token,
        loading: false,
        error: null,
        initialized: true,
        checkingAuth: false,
      })
      return data.user
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Unable to login. Please try again.')
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  logout: async () => {
    try {
      await authAPI.logout()
    } catch {}
    clearStoredAuth()
    set({ user: null, token: null, error: null, initialized: true, checkingAuth: false })
  },

  setUser: (user) => {
    localStorage.setItem('solar_user', JSON.stringify(user))
    set({ user, initialized: true })
  },

  clearError: () => set({ error: null }),
}))

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
    unreadCount: notifications.filter((notification) => !notification.read).length,
  }),
}))
