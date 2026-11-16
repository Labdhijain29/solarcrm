export const CONTACT_PHONE_REGEX = /^\d{10}$/
export const CONTACT_PHONE_MESSAGE = 'Contact number must contain exactly 10 digits.'
export const normalizeContactPhone = value => String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(0, 10)

export const validationMessage = data => {
  if (!Array.isArray(data?.errors)) return ''
  return [...new Set(data.errors.map(error => error.message || error.msg).filter(message => typeof message === 'string' && message.trim()))].join('\n')
}
