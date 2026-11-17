import { useEffect, useRef } from 'react'

export default function useLeadEditorFocus(open) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const editor = ref.current
    editor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    editor?.querySelector('textarea, select, input')?.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [open])
  return ref
}
