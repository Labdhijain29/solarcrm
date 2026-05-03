export const isBrowserFile = (value) => (
  typeof File !== 'undefined' && value instanceof File
)

const getApiBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_URL || '/api'
  if (/^https?:\/\//i.test(configuredBase)) return configuredBase.replace(/\/+$/, '')
  return new URL(configuredBase, window.location.origin).href.replace(/\/+$/, '')
}

const unwrapFileValue = (file) => {
  if (!file) return ''
  if (typeof file === 'string') return file
  if (isBrowserFile(file)) return ''
  return file.fileUrl || file.url || file.secure_url || file.path || ''
}

export const getPublicFileUrl = (file) => {
  const filePath = unwrapFileValue(file)
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath
  if (!filePath.includes('/') && !filePath.startsWith('uploads')) return ''

  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  const apiBaseUrl = getApiBaseUrl()
  const publicBase = apiBaseUrl.replace(/\/api\/?$/i, '')

  return `${publicBase}${normalizedPath}`
}

export const getFileDisplayName = (file, fallback = 'document') => {
  if (!file) return fallback
  if (isBrowserFile(file)) return file.name || fallback
  if (typeof file === 'string') {
    return file.split('/').filter(Boolean).pop() || file || fallback
  }

  return file.originalName
    || file.fileName
    || file.name
    || getFileDisplayName(file.fileUrl || file.url || file.path, fallback)
}

export const getFileMimeType = (file) => {
  if (!file) return ''
  if (isBrowserFile(file)) return file.type || ''
  if (typeof file === 'object') return file.mimeType || file.type || ''
  return ''
}

export const getFileKind = (file) => {
  const name = getFileDisplayName(file, '').toLowerCase()
  const mimeType = getFileMimeType(file).toLowerCase()
  const url = getPublicFileUrl(file).toLowerCase()
  const value = `${name} ${mimeType} ${url}`

  if (/image\/|\.png|\.jpe?g|\.webp|\.gif/.test(value)) return 'image'
  if (/video\/|\.mp4|\.mov|\.avi|\.mkv|\.webm/.test(value)) return 'video'
  if (/pdf|\.pdf/.test(value)) return 'pdf'
  return 'document'
}

export const hasFileValue = (file) => {
  if (!file) return false
  if (isBrowserFile(file)) return true
  if (typeof file === 'string') return Boolean(file.trim())
  return Boolean(file.fileUrl || file.url || file.path || file.originalName || file.name)
}
