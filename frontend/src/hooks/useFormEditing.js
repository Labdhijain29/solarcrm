import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

export const hasFormChanges = (current, original) => Object.keys(current).some(key => current[key] !== original[key])

export function useFormExit(dirty, busy = false) {
  const prompting = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return async action => {
    if (busy || prompting.current) return
    if (!dirty) return action()
    prompting.current = true
    try {
      const result = await Swal.fire({ title: 'Discard unsaved changes?', text: 'Your changes have not been saved.',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Discard Changes', cancelButtonText: 'Keep Editing',
        confirmButtonColor: '#dc2626', cancelButtonColor: '#475569', background: 'var(--card)', color: 'var(--text)',
        focusCancel: true, reverseButtons: true,
      })
      if (result.isConfirmed) action()
    } finally { prompting.current = false }
  }
}

export function useFormFeedback() {
  const formRef = useRef(null)
  const [errors, setErrors] = useState({})
  const report = (fields, message) => {
    setErrors(fields)
    if (message || Object.values(fields).length) toast.error(message || [...new Set(Object.values(fields))].join('\n'))
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector('[data-field] [aria-invalid="true"]')
      field?.focus()
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return false
  }
  const reportApi = (error, fallback) => {
    const data = error.response?.data
    const fields = Object.fromEntries((Array.isArray(data?.errors) ? data.errors : []).map(item => [item.field || item.path, item.message || item.msg]))
    if (/IVRS/i.test(data?.message || '')) fields.ivrsNo = data.message
    report(fields, data?.message || fallback)
  }
  return { formRef, errors, report, reportApi, resetErrors: () => setErrors({}),
    clearError: name => setErrors(previous => { if (!previous[name]) return previous; const next = { ...previous }; delete next[name]; return next }),
  }
}
