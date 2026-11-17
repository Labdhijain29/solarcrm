import ServiceStatusControl from './ServiceStatusControl'
import ServiceRequestForm from './ServiceRequestForm'
import { useAuthStore } from '../../store'
import { SERVICE_STATUS_LABELS, requestServiceStatusChange } from '../../utils/serviceRequestStatus'
import { FaArrowRight, FaCalendarAlt, FaCamera, FaCheckCircle, FaEdit, FaPauseCircle, FaPlayCircle, FaPlus, FaStickyNote, FaTimes, FaUndo } from 'react-icons/fa'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { serviceRequestsAPI } from '../../services/api'
import { FilePreview, Spinner } from '../common'
import LeadDetailFields from './LeadDetailFields'
import ServiceRequestPhotos from './ServiceRequestPhotos'
import useLeadEditorFocus from '../../hooks/useLeadEditorFocus'
import { useFormExit } from '../../hooks/useFormEditing'
import { formatFollowUpDate } from '../../utils/enquiryFollowUp'
import useServiceDialog from '../../hooks/useServiceDialog'

const dateTime = value => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export default function ServiceRequestDetails({ requestId, onClose, onChanged }) {
  const { user } = useAuthStore()
  const [showEdit, setShowEdit] = useState(false)
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])
  const [visit, setVisit] = useState('')
  const [historyLimit, setHistoryLimit] = useState(5)
  const editorRef = useLeadEditorFocus(showUpdate)
  const dirty = showUpdate && Boolean(note.trim() || files.length || visit !== (request?.visitDate || ''))
  const requestExit = useFormExit(dirty, busy)
  const close = () => requestExit(onClose)
  const dialogRef = useServiceDialog(close)

  useEffect(() => {
    let alive = true
    setLoading(true)
    serviceRequestsAPI.getOne(requestId).then(response => {
      if (!alive) return
      setRequest(response.data.data)
      setError('')
      if (!showUpdate) setVisit(response.data.data.visitDate || '')
    }).catch(error => {
      if (alive) setError(error.response?.data?.message || 'Could not load service request.')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [requestId, reload])

  const changeStatus = async status => {
    if (busy) return
    setBusy(true)
    try {
      const result = await requestServiceStatusChange(request, { initialStatus: status || '', onConflict: () => { setReload(value => value + 1); onChanged() } })
      if (result) {
        setRequest(result.data)
        if (!showUpdate) setVisit(result.data.visitDate || '')
        toast.success(result.message)
        onChanged()
      }
    } finally { setBusy(false) }
  }

  const openEdit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const response = await serviceRequestsAPI.getOne(requestId)
      setRequest(response.data.data)
      if (!showUpdate) setVisit(response.data.data.visitDate || '')
      setShowEdit(true)
    } catch (error) { toast.error(error.response?.data?.message || 'Could not open service details.') }
    finally { setBusy(false) }
  }

  const saveUpdate = async event => {
    event.preventDefault()
    if (busy) return
    if (!dirty) { toast.error('Add a note, photos or a different visit date.'); return }
    setBusy(true)
    try {
      const payload = new FormData()
      payload.append('note', note)
      if (visit !== (request.visitDate || '')) payload.append('visitDate', visit)
      files.forEach(file => payload.append('photos', file))
      const response = await serviceRequestsAPI.addActivity(requestId, payload)
      setRequest(response.data.data)
      setVisit(response.data.data.visitDate || '')
      setNote(''); setFiles([]); setShowUpdate(false)
      toast.success(response.data.message)
      onChanged()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save update.')
      if (error.response?.status === 409) { setReload(value => value + 1); onChanged() }
    } finally { setBusy(false) }
  }
  const cancelUpdate = () => { setShowUpdate(false); setNote(''); setFiles([]); setVisit(request.visitDate || '') }
  const history = [...(request?.history || [])].reverse()
  const historyGroups = new Map()
  for (const entry of history.slice(0, historyLimit)) {
    const date = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date unavailable'
    if (!historyGroups.has(date)) historyGroups.set(date, [])
    historyGroups.get(date).push(entry)
  }
  const openUpdate = () => {
    if (!showUpdate) { setShowUpdate(true); return }
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    editorRef.current?.querySelector('textarea')?.focus({ preventScroll: true })
  }
  const historyIcon = action => ({
    Created: FaPlus, 'Note Added': FaStickyNote, 'Photos Added': FaCamera,
    'Visit Updated': FaCalendarAlt, 'On Hold': FaPauseCircle, Resumed: FaPlayCircle,
    Completed: FaCheckCircle, Reopened: FaUndo, 'Details Edited': FaEdit,
  }[action] || FaStickyNote)

  return createPortal(
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) close() }}>
      <section className="modal-box service-request-details" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="service-request-title service-request-number">
        <header className="service-detail-header">
          <div className="service-detail-title">
            <h2 id="service-request-title">{request?.customerName || 'Service Request'}</h2>
            <div id="service-request-number" className="service-request-number">{request?.requestNo || ''}</div>
          </div>
          <div className="service-header-controls">
            {request && !loading && !error && <>
              <button type="button" className="btn btn-secondary btn-sm service-edit-button" disabled={busy} onClick={openEdit}><FaEdit aria-hidden="true" />Edit</button>
              <ServiceStatusControl request={request} disabled={busy} onClick={() => changeStatus()} />
            </>}
            <button type="button" className="btn btn-ghost btn-sm service-close-button" aria-label="Close service request" disabled={busy} onClick={close}><FaTimes aria-hidden="true" /><span>Close</span></button>
          </div>
        </header>
        <div className="service-details-body">
        {loading && <Spinner />}
        {error && <div className="service-error" role="alert">{error}<button type="button" className="btn btn-ghost btn-sm" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
        {request && !loading && !error && <>
          <div className="service-request-info">
            <div><span>Phone</span><strong>{request.contact}</strong></div>
            <div><span>Assigned to</span><strong>{request.assignedTo?.name || '-'}</strong></div>
            <div><span>Visit date</span><strong>{request.visitDate ? formatFollowUpDate(request.visitDate) : 'Not scheduled'}</strong></div>
          </div>
          <section className="service-issue" aria-label="Service issue"><h3>Issue</h3><strong>{request.issue}</strong>{request.description && <p>{request.description}</p>}</section>
          <details className="lead-details-fold"><summary>Customer Details</summary><LeadDetailFields fields={[
            ['Email', request.email || '-'], ['Address', request.address || '-'], ['City', request.city || '-'],
            ['Created by', request.createdBy?.name || '-'], ['Created', dateTime(request.createdAt)], ['Last updated', dateTime(request.updatedAt)],
          ]} /></details>
          <section className="service-history" aria-label="Activity History">
            <h3>Activity History <span>{history.length}</span></h3>
            {[...historyGroups].map(([date, entries]) => <section className="service-history-day" key={date} aria-label={date}>
              <h4>{date}</h4>
              {entries.map(entry => {
                const Icon = historyIcon(entry.action)
                return <article key={entry._id} className={`service-history-entry service-event-${entry.action.toLowerCase().replaceAll(' ', '-')}`}>
                  <div className="service-history-icon"><Icon aria-hidden="true" /></div>
                  <div className="service-history-content">
                    <div className="service-history-heading"><strong>{entry.action}</strong><time dateTime={entry.timestamp} title={dateTime(entry.timestamp)}>{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</time></div>
                    <div className="service-muted">{entry.performedByName}</div>
                    {entry.toStatus && <div className="service-history-transition">{entry.fromStatus && <><span>{SERVICE_STATUS_LABELS[entry.fromStatus]}</span><FaArrowRight aria-hidden="true" /></>}<span>{SERVICE_STATUS_LABELS[entry.toStatus]}</span></div>}
                    {entry.action === 'Visit Updated' && <div className="service-history-visit">Visit {entry.visitDate ? formatFollowUpDate(entry.visitDate) : 'date cleared'}{entry.previousVisitDate ? ` (previously ${formatFollowUpDate(entry.previousVisitDate)})` : ''}</div>}
                    {entry.action === 'Created' && entry.visitDate && <div className="service-muted">Visit {formatFollowUpDate(entry.visitDate)}</div>}
                    {entry.changes?.length > 0 && <dl className="service-history-changes">{entry.changes.map(change => <div key={change.field}><dt>{change.label}</dt><dd><span>{change.field === 'visitDate' && change.oldValue ? formatFollowUpDate(change.oldValue) : change.oldValue || 'Empty'}</span><FaArrowRight aria-label="changed to" /><strong>{change.field === 'visitDate' && change.newValue ? formatFollowUpDate(change.newValue) : change.newValue || 'Empty'}</strong></dd></div>)}</dl>}
                    {entry.note && <p>{entry.note}</p>}
                    {entry.photos?.length > 0 && <div className="service-photo-grid">{entry.photos.map((photo, index) => <FilePreview key={photo.fileKey || index} file={photo} label={`Photo ${index + 1}`} compact />)}</div>}
                  </div>
                </article>
              })}
            </section>)}
            {history.length > historyLimit && <button type="button" className="btn btn-ghost btn-sm service-show-older" onClick={() => setHistoryLimit(value => value + 5)}>Show older updates ({history.length - historyLimit})</button>}
          </section>
          {showUpdate && <form className="service-update-form" ref={editorRef} onSubmit={saveUpdate}>
            <label className="form-label" htmlFor="service-update-note">Note</label><textarea id="service-update-note" className="crm-input" rows={3} maxLength={3000} placeholder="Write a service update..." value={note} disabled={busy} onChange={event => setNote(event.target.value)} />
            <ServiceRequestPhotos id="service-update-photos" files={files} onChange={setFiles} disabled={busy} />
            <label className="form-label" htmlFor="service-update-visit">Visit date (optional)</label><input id="service-update-visit" className="crm-input service-visit-input" type="date" value={visit} disabled={busy} onChange={event => setVisit(event.target.value)} onClick={event => { try { event.currentTarget.showPicker?.() } catch {} }} />
            <div className="service-editor-actions"><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelUpdate}>Cancel</button><button type="submit" className="btn btn-primary btn-sm" disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save Update'}</button></div>
          </form>}

        </>}
        </div>
        {request && !loading && !error && <footer className="service-details-footer">
          <div className="service-request-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} aria-expanded={showUpdate} onClick={openUpdate}><FaPlus aria-hidden="true" />Add Update</button>
            {request.status === 'completed'
              ? <button type="button" className="btn btn-secondary service-action-primary" disabled={busy} onClick={() => changeStatus('pending')}><FaUndo aria-hidden="true" />Reopen</button>
              : <button type="button" className="btn btn-success service-action-primary" disabled={busy} onClick={() => changeStatus('completed')}><FaCheckCircle aria-hidden="true" />Complete Request</button>}
          </div>
        </footer>}
      </section>
      {showEdit && request && <ServiceRequestForm user={user} request={request} onClose={() => setShowEdit(false)} onSaved={updated => { setRequest(updated); if (!showUpdate) setVisit(updated.visitDate || ''); setShowEdit(false); onChanged() }} />}
    </div>, document.body
  )
}
