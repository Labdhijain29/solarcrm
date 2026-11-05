const RELOAD_KEY = 'solar_build_reload'
const VERSION_PARAM = '__app_build'

// Run only at document startup, before mounting forms or starting authentication.
export const ensureCurrentAppVersion = async ({
  currentVersion,
  fetchImpl = globalThis.fetch,
  location = window.location,
  history = window.history,
  getStorage = () => window.sessionStorage,
  timeoutMs = 3000,
  now = Date.now,
}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`/version.json?check=${now()}`, {
      cache: 'no-store', credentials: 'omit', signal: controller.signal,
    })
    if (!response.ok) return 'unavailable'
    const { version } = await response.json()
    if (typeof version !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(version)) return 'unavailable'
    const url = new URL(location.href)
    if (version === currentVersion) {
      try { getStorage().removeItem(RELOAD_KEY) } catch { /* Storage may be disabled. */ }
      if (url.searchParams.has(VERSION_PARAM)) {
        url.searchParams.delete(VERSION_PARAM)
        history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
      }
      return 'ready'
    }
    // The URL marker also prevents loops when session storage is unavailable.
    if (url.searchParams.get(VERSION_PARAM) === version) return 'outdated'
    try {
      const storage = getStorage()
      if (storage.getItem(RELOAD_KEY) === version) return 'outdated'
      storage.setItem(RELOAD_KEY, version)
    } catch { /* The URL remains the fallback loop guard. */ }
    url.searchParams.set(VERSION_PARAM, version)
    location.replace(url.href)
    return 'reloading'
  } catch {
    // A metadata outage must not prevent the app from opening.
    return 'unavailable'
  } finally {
    clearTimeout(timeout)
  }
}
