import { useState } from 'react'
import { formatFollowUpDate, followUpState, isConvertedEnquiry } from '../../utils/enquiryFollowUp'

const STATE_LABELS = { overdue: 'Follow-up date passed', today: 'Follow up today', upcoming: 'Follow up later', none: 'No follow-up date', converted: 'Converted to a lead', closed: 'Enquiry closed' }

export default function EnquiryFollowUpModal({ enquiry, today, saving, onClose, onSave }) {
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [mode, setMode] = useState('schedule')
  const converted = isConvertedEnquiry(enquiry)
  const closed = enquiry.status === 'closed'
  const state = followUpState(enquiry, today)
  const history = [...(enquiry.followUps || [])].reverse()

  const submit = (event) => {
    event.preventDefault()
    if (!note.trim() || (mode === 'schedule' && !dueDate)) return
    onSave({ note: note.trim(), dueDate: mode === 'schedule' ? dueDate : null, completed: mode === 'complete' })
      .then((saved) => {
        if (saved) { setNote(''); setDueDate(''); setMode('schedule') }
      })
  }

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box enquiry-follow-up-modal" role="dialog" aria-modal="true" aria-label={`Follow up for ${enquiry.name}`}>
        <div className="enquiry-follow-up-header">
          <div>
            <h2>Follow up for {enquiry.name}</h2>
            <div className="enquiry-follow-up-contact">{enquiry.contact || enquiry.phone || '-'}{enquiry.enquiryType ? ` · ${enquiry.enquiryType}` : ''}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className={`enquiry-follow-up-current follow-up-${state}`}>
          <span>{STATE_LABELS[state]}</span>
          <strong>{state === 'converted' || state === 'closed' ? 'Past notes are saved below' : state === 'none' ? 'Add a date below to remind the team' : formatFollowUpDate(enquiry.nextFollowUpDate)}</strong>
        </div>

        {!converted && !closed && (
          <form onSubmit={submit} className="enquiry-follow-up-form">
            <h3>Add a follow-up</h3>
            <label className="form-label" htmlFor="follow-up-note">What did the customer say? What should we do next?</label>
            <textarea id="follow-up-note" className="crm-input" rows={4} maxLength={2000} required value={note}
              onChange={(event) => setNote(event.target.value)} placeholder="Example: Customer is arranging money. Contact them again on Friday." />
            <div className="enquiry-follow-up-choice" role="group" aria-label="Do we need to contact this customer again?">
              <label><input type="radio" name="follow-up-mode" value="schedule" checked={mode === 'schedule'} onChange={() => setMode('schedule')} /> Yes, remind us to contact them</label>
              <label><input type="radio" name="follow-up-mode" value="complete" checked={mode === 'complete'} onChange={() => setMode('complete')} /> No, remove the reminder</label>
            </div>
            {mode === 'schedule' && (
              <div>
                <label className="form-label" htmlFor="follow-up-date">Remind the team on</label>
                <input id="follow-up-date" className="crm-input" type="date" min={today} required value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  onClick={(event) => {
                    try { event.currentTarget.showPicker?.() } catch { event.currentTarget.focus() }
                  }}
                  style={{ cursor:'pointer' }} />
              </div>
            )}
            <div className="enquiry-follow-up-submit">
              <span>{mode === 'complete'
                ? 'This removes the current reminder. The enquiry and earlier notes stay saved.'
                : 'We will show this enquiry on that date. This replaces the old reminder date.'}</span>
              <button type="submit" className="btn btn-primary" disabled={saving || !note.trim() || (mode === 'schedule' && !dueDate)}>
                {saving ? 'Saving...' : mode === 'complete' ? 'Save note, remove reminder' : 'Save follow-up and date'}
              </button>
            </div>
          </form>
        )}

        <div className="enquiry-follow-up-history">
          <h3>Follow-up history <span>({history.length})</span></h3>
          {history.length === 0 ? (
            <p>No follow-ups have been added yet.</p>
          ) : (
            <ol className="enquiry-follow-up-timeline">
              {history.map((item) => (
                <li key={item._id || item.createdAt}>
                  <div className="enquiry-follow-up-entry-head">
                    <strong>{item.completed ? 'No new reminder set' : `Contact again on ${formatFollowUpDate(item.dueDate)}`}</strong>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</span>
                  </div>
                  <p>{item.note}</p>
                  <small>Added by {item.createdByName || 'Team member'}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
