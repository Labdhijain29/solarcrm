import { clearClientSession, abortSessionRequests, SESSION_RESET_EVENT } from '../utils/session'
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

let hydrateAuthPromise = null
let authRevision = 0
const signedOut = { user:null, token:null, loading:false, error:null, initialized:true, checkingAuth:false }

export const useAuthStore = create((set, get) => ({
  ...signedOut,
  user: getStoredUser(),
  token: getStoredToken(),
  initialized: false,

  hydrateAuth: async () => {
    const token = getStoredToken()
    // A logged-out tab must not broadcast another reset and make other tabs
    // reload repeatedly (or cancel a sign-in currently running in another tab).
    if (!token) { clearClientSession({ rotate:false }); return null }
    if (get().checkingAuth && hydrateAuthPromise) return hydrateAuthPromise
    const revision = authRevision
    set({ checkingAuth:true, token, error:null })
    const pending = authAPI.getMe()
      .then(({ data }) => {
        if (revision !== authRevision || token !== getStoredToken()) return null
        const user = data.user
        localStorage.setItem('solar_user', JSON.stringify(user))
        set({ user, token, loading:false, error:null, initialized:true, checkingAuth:false })
        return user
      })
      .catch(err => {
        if (revision !== authRevision || token !== getStoredToken()) return null
        if (err.response?.status === 401) { clearClientSession(); return null }
        set({ user:null, token, loading:false, error:getApiErrorMessage(err, 'Unable to verify your session.'), initialized:true, checkingAuth:false })
        return null
      })
      .finally(() => { if (hydrateAuthPromise === pending) hydrateAuthPromise = null })
    hydrateAuthPromise = pending
    return pending
  },

  login: async (email, password) => {
    clearClientSession()
    const revision = authRevision
    set({ ...signedOut, loading:true })
    try {
      const { data } = await authAPI.login({ email, password })
      if (revision !== authRevision) throw Object.assign(new Error('Sign-in cancelled.'), { code:'ERR_CANCELED' })
      // Always begin a fresh sign-in in the office supplied by this database.
      localStorage.setItem('solar_token', data.token)
      localStorage.setItem('solar_user', JSON.stringify(data.user))
      set({ ...signedOut, user:data.user, token:data.token })
      return data.user
    } catch (err) {
      if (revision !== authRevision || err.code === 'ERR_CANCELED') throw err
      const msg = getApiErrorMessage(err, 'Unable to login. Please try again.')
      set({ error:msg, loading:false })
      throw new Error(msg)
    }
  },

  logout: async () => {
    const token = getStoredToken()
    clearClientSession()
    // Local sign-out is immediate even if the server is stopped or unreachable.
    if (token) void authAPI.logout(token).catch(() => {})
  },

  setUser: user => {
    localStorage.setItem('solar_user', JSON.stringify(user))
    set({ user, initialized:true })
  },
  clearError: () => set({ error:null }),
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

const resetSessionState = () => {
  authRevision++
  hydrateAuthPromise = null
  useAuthStore.setState(signedOut)
  useAppStore.setState({ notifications:[], unreadCount:0, sidebarOpen:false })
}
window.addEventListener(SESSION_RESET_EVENT, resetSessionState)
window.addEventListener('storage', event => {
  if (['solar_token', 'solar_session_version'].includes(event.key)) {
    abortSessionRequests()
    resetSessionState()
    window.location.replace('/login')
  }
})
