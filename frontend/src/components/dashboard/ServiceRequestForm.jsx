import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { serviceRequestsAPI } from '../../services/api'
import { FormActions, FormFields } from '../common/FormLayout'
import { hasFormChanges, useFormExit, useFormFeedback } from '../../hooks/useFormEditing'
import { CONTACT_PHONE_REGEX, normalizeContactPhone } from '../../utils/contactValidation'
import ServiceRequestPhotos from './ServiceRequestPhotos'
import useServiceDialog from '../../hooks/useServiceDialog'

const emptyForm = { customerName: '', contact: '', email: '', address: '', city: '', issue: '', description: '', visitDate: '', assignedTo: '' }

export default function ServiceRequestForm({ user, request = null, onClose, onCreated, onSaved }) {
  const editing = Boolean(request)
  const baseline = useRef(request ? Object.fromEntries(Object.keys(emptyForm).map(field => [field, field === 'assignedTo' ? '' : request[field] || ''])) : { ...emptyForm })
  const [form, setForm] = useState(baseline.current)
  const [files, setFiles] = useState([])
  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(!editing && user.role === 'Admin')
  const [managerError, setManagerError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const feedback = useFormFeedback()
  const requestExit = useFormExit(hasFormChanges(form, baseline.current) || files.length > 0, busy)
  const close = () => requestExit(onClose)
  const dialogRef = useServiceDialog(close, 'input')

  useEffect(() => {
    if (editing || user.role !== 'Admin') return
    let alive = true
    setLoadingManagers(true)
    serviceRequestsAPI.getManagers().then(response => {
      if (!alive) return
      const available = response.data.data || []
      setManagers(available)
      setForm(previous => {
        if (available.some(manager => manager._id === previous.assignedTo)) return previous
        const assignedTo = available[0]?._id || ''
        baseline.current = { ...baseline.current, assignedTo }
        return { ...previous, assignedTo }
      })
      setManagerError('')
    }).catch(error => {
      if (alive) setManagerError(error.response?.data?.message || 'Could not load Service Managers.')
    }).finally(() => { if (alive) setLoadingManagers(false) })
    return () => { alive = false }
  }, [user.role, editing, retry])

  const update = event => {
    const { name, value } = event.target
    feedback.clearError(name)
    setForm(previous => ({ ...previous, [name]: name === 'contact' ? normalizeContactPhone(value) : value }))
  }
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const errors = {}
    if (!form.customerName.trim()) errors.customerName = 'Customer name is required.'
    if (!CONTACT_PHONE_REGEX.test(form.contact)) errors.contact = 'Enter a 10-digit contact number.'
    if (!form.issue.trim()) errors.issue = 'Issue is required.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
    if (!editing && user.role === 'Admin' && !form.assignedTo) errors.assignedTo = 'Select a Service Manager.'
    if (Object.keys(errors).length) return feedback.report(errors)
    feedback.resetErrors()
    setBusy(true)
    try {
      if (editing) {
        const values = Object.fromEntries(Object.entries(form).filter(([field]) => field !== 'assignedTo'))
        const response = await serviceRequestsAPI.update(request._id, { ...values, expectedVersion: request.__v })
        toast.success(response.data.message)
        onSaved(response.data.data)
      } else {
        const payload = new FormData()
        Object.entries(form).forEach(([name, value]) => payload.append(name, value))
        files.forEach(file => payload.append('photos', file))
        const response = await serviceRequestsAPI.create(payload)
        toast.success(response.data.message)
        onCreated(response.data.data)
      }
    } catch (error) { feedback.reportApi(error, editing ? 'Could not save service details.' : 'Could not create service request.') }
    finally { setBusy(false) }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) close() }}>
      <section className="modal-box form-dialog service-request-form" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="service-create-title">
        <header className="form-dialog-header"><h2 id="service-create-title">{editing ? `Edit ${request.requestNo}` : 'New Service Request'}</h2><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={close}>Close</button></header>
        <form id="service-create-form" className="form-dialog-body" ref={feedback.formRef} noValidate onSubmit={submit}>
          <fieldset className="form-fieldset" disabled={busy}>
            <FormFields kind="service" errors={feedback.errors} clearError={feedback.clearError}>
              <div><label className="form-label" htmlFor="service-customer">Customer name *</label><input autoComplete="name" id="service-customer" className="crm-input" name="customerName" maxLength={120} value={form.customerName} onChange={update} /></div>
              <div><label className="form-label" htmlFor="service-contact">Contact number *</label><input id="service-contact" className="crm-input" name="contact" inputMode="numeric" maxLength={10} value={form.contact} onChange={update} /></div>
              <div><label className="form-label" htmlFor="service-email">Email</label><input id="service-email" type="email" className="crm-input" name="email" maxLength={254} value={form.email} onChange={update} /></div>
              <div><label className="form-label" htmlFor="service-city">City</label><input id="service-city" className="crm-input" name="city" maxLength={120} value={form.city} onChange={update} /></div>
              <div><label className="form-label" htmlFor="service-visit">Visit date (optional)</label><input id="service-visit" type="date" className="crm-input" name="visitDate" value={form.visitDate} onChange={update} onClick={event => { try { event.currentTarget.showPicker?.() } catch {} }} /></div>
              {!editing && user.role === 'Admin' && <div><label className="form-label" htmlFor="service-assignee">Service Manager *</label><select id="service-assignee" className="crm-input" name="assignedTo" value={form.assignedTo} disabled={loadingManagers || managers.length === 0} onChange={update}><option value="">{loadingManagers ? 'Loading...' : 'Select Service Manager'}</option>{managers.map(manager => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select>
                {managerError ? <div role="alert">{managerError} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : !loadingManagers && !managers.length && <p className="service-muted">Add an active Service Manager in Users first.</p>}
              </div>}
              <div><label className="form-label" htmlFor="service-issue">Issue *</label><input id="service-issue" className="crm-input" name="issue" placeholder="e.g. Solar panel cleaning" maxLength={150} value={form.issue} onChange={update} /></div>
              <div className="service-form-wide"><label className="form-label" htmlFor="service-address">Address</label><textarea id="service-address" className="crm-input" name="address" rows={2} maxLength={3000} value={form.address} onChange={update} /></div>
              <div className="service-form-wide"><label className="form-label" htmlFor="service-description">Issue details</label><textarea id="service-description" className="crm-input" name="description" rows={3} maxLength={3000} value={form.description} onChange={update} /></div>
            </FormFields>
            {!editing && <ServiceRequestPhotos id="service-create-photos" files={files} onChange={setFiles} disabled={busy} />}
          </fieldset>
        </form>
        <FormActions busy={busy} disabled={editing && !hasFormChanges(form, baseline.current)} onCancel={close} form="service-create-form" label={editing ? 'Save Changes' : 'Create Request'} />
      </section>
    </div>, document.body
  )
}
