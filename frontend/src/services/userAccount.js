import { authAPI, usersAPI } from './api'
import { buildAccountFormData } from '../utils/userAccount'
import Swal from 'sweetalert2'

export const deleteUserAccount = async (user) => {
  const result = await Swal.fire({
    title: 'Delete user?',
    text: `Delete "${user.name || 'this user'}" permanently? This cannot be undone.`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Yes, delete user', cancelButtonText: 'Cancel',
    confirmButtonColor: '#ef4444', cancelButtonColor: '#475569',
    background: 'var(--card)', color: 'var(--text)', focusCancel: true, reverseButtons: true,
  })
  if (!result.isConfirmed) return false
  await usersAPI.delete(user._id)
  return true
}

// Share the payload while preserving the existing authenticated/public API contracts.
export const submitUserAccount = async (form, { admin = false, onDocumentError } = {}) => {
  const payload = buildAccountFormData(form, admin)
  const response = await (admin ? usersAPI.create(payload) : authAPI.register(payload))
  if (!admin && form.documents) {
    const userId = response.data?.data?._id
    const uploadToken = response.data?.documentUploadToken
    if (userId && uploadToken) {
      const documentData = new FormData()
      documentData.append('documents', form.documents)
      documentData.append('uploadToken', uploadToken)
      authAPI.uploadRegistrationDocument(userId, documentData).catch(() => onDocumentError?.())
    } else {
      onDocumentError?.()
    }
  }
  return response
}
