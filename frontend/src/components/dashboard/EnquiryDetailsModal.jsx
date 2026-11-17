import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes } from 'react-icons/fa'
import LeadDetailFields from './LeadDetailFields'
import { formatFollowUpDate, isConvertedEnquiry } from '../../utils/enquiryFollowUp'

export default function EnquiryDetailsModal({ enquiry, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector('button')?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  const keyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key === 'Tab') {
      const buttons = [...ref.current.querySelectorAll('button')]
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
  }
  const fields = [
    ['Name', enquiry.name || '-'], ['Contact', enquiry.contact || enquiry.phone || '-'], ['Email', enquiry.email || '-'],
    ['IVRS No.', enquiry.ivrsNo || '-'], ['Enquiry Type', enquiry.enquiryType || '-'],
    ['Status', isConvertedEnquiry(enquiry) ? 'Converted' : enquiry.status || '-'],
    ['City', enquiry.city || '-'], ['State', enquiry.state || '-'], ['Pincode', enquiry.pincode || '-'],
    ['Address', enquiry.address || '-'], ['Source', enquiry.source || '-'],
    ['Received', enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleString('en-IN') : '-'],
    ['Next Follow-up', enquiry.nextFollowUpDate ? formatFollowUpDate(enquiry.nextFollowUpDate) : '-'],
    ['Notes', enquiry.notes || '-'],
  ]
  return createPortal(
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-box enquiry-details-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="enquiry-details-title" onKeyDown={keyDown}>
        <header className="enquiry-details-heading"><h2 id="enquiry-details-title">Enquiry Details</h2><button type="button" className="btn btn-ghost btn-sm" aria-label="Close enquiry details" onClick={onClose}><FaTimes /></button></header>
        <LeadDetailFields fields={fields} />
        <div className="enquiry-details-close"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button></div>
      </section>
    </div>, document.body
  )
}
