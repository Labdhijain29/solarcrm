import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaEllipsisH } from 'react-icons/fa'
import { isConvertedEnquiry } from '../../utils/enquiryFollowUp'

export default function EnquiryListActions({ enquiry, canChange, canConvert, convertingId, onFollowUp, onConvert, onView, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const positionMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect()
    const height = canChange ? 142 : 54
    setPosition({ left: Math.max(8, Math.min(rect.right - 170, window.innerWidth - 178)), top: rect.bottom + height < window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height) })
  }

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('button')?.focus({ preventScroll: true })
    const outside = event => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false)
    }
    const reposition = event => {
      if (menuRef.current?.contains(event.target)) return
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) setOpen(false)
      else positionMenu()
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => {
    positionMenu()
    setOpen(value => !value)
  }
  const menuKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'Tab') { close(); return }
    const buttons = [...menuRef.current.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }
  }
  const choose = action => { close(); action(enquiry) }

  return (
    <div className="enquiry-list-actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onFollowUp(enquiry._id)}>
        {isConvertedEnquiry(enquiry) || enquiry.status === 'closed' ? 'View follow-ups' : 'Follow up'}
      </button>
      {canConvert && <button type="button" className="btn btn-success btn-sm" disabled={Boolean(convertingId)} onClick={() => onConvert(enquiry._id)}>{convertingId === enquiry._id ? 'Converting...' : 'Create Lead'}</button>}
      <button type="button" className="btn btn-ghost btn-sm enquiry-more-button" ref={triggerRef} aria-label={`More actions for ${enquiry.name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={toggle}><FaEllipsisH aria-hidden="true" /><span>More</span></button>
      {open && createPortal(
        <div className="enquiry-actions-menu" role="menu" aria-label={`Actions for ${enquiry.name}`} id={menuId} style={position} ref={menuRef} onKeyDown={menuKey}>
          <button type="button" role="menuitem" onClick={() => choose(onView)}>View Details</button>
          {canChange && <button type="button" role="menuitem" onClick={() => choose(onEdit)}>Edit</button>}
          {canChange && <button type="button" role="menuitem" className="enquiry-menu-delete" onClick={() => choose(onDelete)}>Delete</button>}
        </div>, document.body
      )}
    </div>
  )
}
