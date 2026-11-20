export const SESSION_RESET_EVENT = 'solar-session-reset'
const VERSION_KEY = 'solar_session_version'
const requests = new Set()

export const getSessionVersion = () => {
  let version = localStorage.getItem(VERSION_KEY)
  if (!version) {
    version = crypto.randomUUID()
    localStorage.setItem(VERSION_KEY, version)
  }
  return version
}

export const clearOfficeSelections = () => {
  for (const key of Object.keys(localStorage)) {
    if (key === 'solar_office' || key.startsWith('solar_office_')) localStorage.removeItem(key)
  }
  delete window.solarOfficeContext
}

export const abortSessionRequests = () => {
  for (const controller of requests) controller.abort()
  requests.clear()
}

export const clearClientSession = ({ rotate = true } = {}) => {
  // Only authentication/workspace state is cleared. Theme and Remember Me stay.
  localStorage.removeItem('solar_token')
  localStorage.removeItem('solar_user')
  clearOfficeSelections()
  if (rotate) localStorage.setItem(VERSION_KEY, crypto.randomUUID())
  abortSessionRequests()
  window.dispatchEvent(new Event(SESSION_RESET_EVENT))
}

export const trackSessionRequest = config => {
  config.sessionVersion = getSessionVersion()
  config.sessionToken = localStorage.getItem('solar_token')
  const controller = new AbortController()
  const previousSignal = config.signal
  const cancel = () => controller.abort()
  if (previousSignal?.aborted) cancel()
  else previousSignal?.addEventListener('abort', cancel, { once:true })
  requests.add(controller)
  config.signal = controller.signal
  config.releaseSessionRequest = () => {
    requests.delete(controller)
    previousSignal?.removeEventListener('abort', cancel)
  }
}

export const isOldSessionRequest = config => Boolean(config?.sessionVersion && (
  config.sessionVersion !== getSessionVersion() || config.sessionToken !== localStorage.getItem('solar_token')
))
