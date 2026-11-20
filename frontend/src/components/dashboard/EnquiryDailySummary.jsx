import { createPortal } from 'react-dom'
import { FaArrowRight, FaCalendarAlt, FaCheckCircle, FaClock, FaExclamationCircle, FaRegBuilding, FaSun, FaTimes } from 'react-icons/fa'
import useServiceDialog from '../../hooks/useServiceDialog'
import { formatFollowUpDate } from '../../utils/enquiryFollowUp'

// A daily display preference survives logout, independently of authentication.
const seenInThisTab = new Set()
export function claimDailyEnquirySummary(userId, officeId, day) {
  if (!userId || !officeId || !day) return false
  const key = `solar_enquiry_summary_${userId}_${officeId}`
  const marker = `${key}:${day}`
  if (seenInThisTab.has(marker)) return false
  try {
    if (localStorage.getItem(key) === day) return false
    localStorage.setItem(key, day)
  } catch { /* Keep the page usable when browser storage is unavailable. */ }
  seenInThisTab.add(marker)
  return true
}

const enquiriesLabel = count => `${count} ${count === 1 ? 'enquiry' : 'enquiries'}`

export default function EnquiryDailySummary({ overview, day, officeName, onClose, onSelect }) {
  const ref = useServiceDialog(onClose)
  const due = overview.today + overview.overdue
  return createPortal(
    <div className="modal-backdrop enquiry-summary-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-box enquiry-summary" ref={ref} role="dialog" aria-modal="true" aria-labelledby="enquiry-summary-title" aria-describedby="enquiry-summary-intro">
        <header className="enquiry-summary-heading">
          <span className="enquiry-summary-emblem" aria-hidden="true"><FaSun /></span>
          <div><h2 id="enquiry-summary-title">Your Daily Follow-up Summary</h2><div className="enquiry-summary-meta"><span><FaRegBuilding aria-hidden="true" />{officeName}</span><span>{formatFollowUpDate(day)}</span></div></div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close daily summary" onClick={onClose}><FaTimes /></button>
        </header>
        <div className={`enquiry-summary-intro ${due === 0 ? 'is-clear' : ''}`} id="enquiry-summary-intro">
          {due > 0 ? <><strong>{enquiriesLabel(due)}</strong> {due === 1 ? 'needs' : 'need'} attention.</> : <><FaCheckCircle aria-hidden="true" /><span><strong>You’re all caught up.</strong> No follow-ups due today.</span></>}
        </div>
        <div className="enquiry-summary-counts">
          <button type="button" className="enquiry-summary-count is-overdue" onClick={() => onSelect('overdue')} aria-label={`${enquiriesLabel(overview.overdue)} overdue`}>
            <span className="enquiry-summary-count-label"><FaExclamationCircle aria-hidden="true" />Overdue</span>
            <strong>{overview.overdue}</strong><span className="enquiry-summary-count-help">Date has passed <FaArrowRight aria-hidden="true" /></span>
          </button>
          <button type="button" className="enquiry-summary-count is-today" onClick={() => onSelect('today')} aria-label={`${enquiriesLabel(overview.today)} due today`}>
            <span className="enquiry-summary-count-label"><FaClock aria-hidden="true" />Due today</span>
            <strong>{overview.today}</strong><span className="enquiry-summary-count-help">Follow up today <FaArrowRight aria-hidden="true" /></span>
          </button>
        </div>
        <button type="button" className="enquiry-summary-upcoming" onClick={() => onSelect('upcoming')} aria-label={`${enquiriesLabel(overview.upcoming)} with upcoming follow-ups`}>
          <FaCalendarAlt aria-hidden="true" /><span>Upcoming follow-ups</span><strong>{overview.upcoming}</strong><FaArrowRight aria-hidden="true" />
        </button>
        <footer className="enquiry-summary-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => onSelect(due > 0 ? 'due' : 'all')}>{due > 0 ? 'View All Due Follow-ups' : 'View Enquiries'}<FaArrowRight aria-hidden="true" /></button>
        </footer>
      </section>
    </div>, document.body
  )
}
