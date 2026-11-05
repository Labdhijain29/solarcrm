import { ROLE_STAGE_MAP } from './constants'

export const accountRoles = (admin = false) => Object.keys(ROLE_STAGE_MAP).filter(role => admin || role !== 'Admin')
export const normalizeAccountPhone = value => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)
export const normalizeAccountEmail = value => String(value || '').trim().toLowerCase()
export const todayAccountDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const validateAccountForm = (form, admin = false) => {
  if (!form.name.trim()) return 'Name required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAccountEmail(form.email))) return 'Enter a valid email address.'
  if (form.password.length < 6) return 'Password must be at least 6 characters.'
  if (!accountRoles(admin).includes(form.role)) return 'Select a valid role.'
  if (!/^[6-9]\d{9}$/.test(normalizeAccountPhone(form.phone))) return 'Contact number must be a valid 10-digit mobile number.'
  if (form.alternateContact && !/^[6-9]\d{9}$/.test(normalizeAccountPhone(form.alternateContact))) return 'Alternate contact must also be a valid 10-digit number.'
  if (form.pincode && !/^\d{6}$/.test(form.pincode)) return 'Pincode must contain 6 digits.'
  if (form.documents) {
    if (!/\.(pdf|png|jpg|jpeg|doc|docx)$/i.test(form.documents.name)) return 'Only PDF, JPG, PNG, DOC, and DOCX files are allowed.'
    if (form.documents.size > 5 * 1024 * 1024) return 'Document must be 5MB or smaller.'
  }
  return ''
}

export const buildAccountFormData = (form, includeDocument = false) => {
  const data = new FormData()
  for (const key of ['name', 'email', 'password', 'role', 'phone', 'alternateContact', 'permanentAddress',
    'address', 'state', 'city', 'pincode', 'dateOfJoining', 'franchiseEnabled', 'franchiseName',
    'franchiseState', 'franchiseCity', 'franchiseSubDistrict']) {
    let value = form[key] ?? ''
    if (key === 'email') value = normalizeAccountEmail(value)
    if (key === 'name') value = value.trim()
    if (['phone', 'alternateContact'].includes(key)) value = normalizeAccountPhone(value)
    if (key.startsWith('franchise') && key !== 'franchiseEnabled' && !form.franchiseEnabled) value = ''
    data.append(key, String(value))
  }
  if (includeDocument && form.documents) data.append('documents', form.documents)
  return data
}
