import { createPortal } from 'react-dom'
import EnquiryListActions from '../../components/dashboard/EnquiryListActions'
import EnquiryDetailsModal from '../../components/dashboard/EnquiryDetailsModal'
import { useEffect, useRef, useState } from 'react'
import { FaBell } from 'react-icons/fa'
import { useLocation, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { EmptyState, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import { enquiriesAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { getCitiesForState, STATE_OPTIONS } from '../../utils/constants'
import EnquiryFormModal from '../../components/dashboard/EnquiryFormModal'
import { FormActions, FormFields } from '../../components/common/FormLayout'
import { hasFormChanges, useFormExit, useFormFeedback } from '../../hooks/useFormEditing'
import EnquiryFollowUpModal from '../../components/dashboard/EnquiryFollowUpModal'
import { formatFollowUpDate, followUpState, indiaToday, isConvertedEnquiry } from '../../utils/enquiryFollowUp'
import { CONTACT_PHONE_REGEX, CONTACT_PHONE_MESSAGE, normalizeContactPhone } from '../../utils/contactValidation'

const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']
const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'closed']
const DEFAULT_CONVERSION_FILTER = 'not-converted'
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const CAPITALIZED_FIELDS = new Set(['name', 'address', 'state', 'city', 'notes'])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)
const emptyEditForm = {
  name: '',
  ivrsNo: '',
  contact: '',
  email: '',
  address: '',
  enquiryType: '',
  state: '',
  city: '',
  pincode: '',
  status: 'new',
  notes: '',
}

export default function EnquiriesPage({ embedded = false, refreshKey = 0, onConverted }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [detailsId, setDetailsId] = useState('')
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const editBaseline = useRef(emptyEditForm)
  const feedback = useFormFeedback()
  const requestExit = useFormExit(Boolean(editing) && hasFormChanges(editForm, editBaseline.current), saving)
  const [search, setSearch] = useState('')
  const [conversionFilter, setConversionFilter] = useState(DEFAULT_CONVERSION_FILTER)
  const [followUpFilter, setFollowUpFilter] = useState(searchParams.get('followUp') === 'due' ? 'due' : 'all')
  const [today, setToday] = useState(indiaToday)
  const [sortBy, setSortBy] = useState('latest')
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)
  const [convertingId, setConvertingId] = useState('')
  const [followUpEnquiryId, setFollowUpEnquiryId] = useState('')
  const [savingFollowUp, setSavingFollowUp] = useState(false)

  const isExecutive = user?.role === 'Enquiry Executive'
  const canChangeEnquiry = (enquiry) => ['Admin', 'Manager'].includes(user?.role) || (
    isExecutive && String(enquiry.createdBy?._id || enquiry.createdBy || '') === String(user?._id)
    && !enquiry.convertedTo && enquiry.status !== 'converted'
  )
  const canConvert = ['Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Enquiry Executive'].includes(user?.role)
  const canConvertEnquiry = (enquiry) => canConvert && enquiry.enquiryType?.trim().toLowerCase() !== 'service enquiry'
    && !enquiry.convertedTo && enquiry.status !== 'converted'

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await enquiriesAPI.getAll()
      setEnquiries(response.data.data || [])
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load enquiries'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  useEffect(() => {
    if (searchParams.get('followUp') === 'due') setFollowUpFilter('due')
  }, [location.key, searchParams.get('followUp')])

  useEffect(() => {
    const refreshToday = () => setToday(indiaToday())
    const timer = setInterval(refreshToday, 60000)
    window.addEventListener('focus', refreshToday)
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshToday) }
  }, [])

  const convert = async (id) => {
    if (convertingId) return
    setConvertingId(id)
    try {
      const response = await enquiriesAPI.convertToLead(id)
      toast.success(response.data.message || 'Lead created from enquiry.')
      onConverted?.()
      window.dispatchEvent(new Event('enquiry-follow-ups-changed'))
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert enquiry')
    } finally {
      setConvertingId('')
    }
  }

  const openEdit = (enquiry) => {
    setEditing(enquiry)
    const values = {
      name: enquiry.name || '',
      ivrsNo: enquiry.ivrsNo || '',
      contact: enquiry.contact || enquiry.phone || '',
      email: enquiry.email || '',
      address: enquiry.address || '',
      enquiryType: enquiry.enquiryType || '',
      state: enquiry.state || '',
      city: enquiry.city || '',
      pincode: enquiry.pincode || '',
      status: enquiry.status || 'new',
      notes: enquiry.notes || '',
    }
    editBaseline.current = values
    setEditForm(values)
    feedback.resetErrors()
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm(emptyEditForm)
  }

  const updateField = (key, value) => setEditForm(prev => {
    if (key === 'state') return { ...prev, state: value, city: '' }
    if (key === 'contact') return { ...prev, contact: normalizeContactPhone(value) }
    if (key === 'pincode') return { ...prev, pincode: String(value || '').replace(/\D/g, '').slice(0, 6) }
    if (key === 'ivrsNo') return { ...prev, ivrsNo: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) }
    if (CAPITALIZED_FIELDS.has(key)) return { ...prev, [key]: capitalizeFirstLetter(value) }
    return { ...prev, [key]: value }
  })

  const saveEdit = async () => {
    if (!editing) return
    const errors = {}
    if (!editForm.name.trim()) errors.name = 'Name is required.'
    if (!CONTACT_PHONE_REGEX.test(editForm.contact)) errors.contact = CONTACT_PHONE_MESSAGE
    if (!editForm.enquiryType) errors.enquiryType = 'Please select an enquiry type.'
    if (editForm.pincode && !/^\d{6}$/.test(editForm.pincode)) errors.pincode = 'Pincode must contain exactly 6 digits.'
    if (Object.keys(errors).length) return feedback.report(errors)
    feedback.resetErrors()
    setSaving(true)
    try {
      await enquiriesAPI.update(editing._id, editForm)
      toast.success('Enquiry updated successfully.')
      closeEdit()
      fetchData()
    } catch (err) {
      feedback.reportApi(err, 'Failed to update enquiry')
    } finally {
      setSaving(false)
    }
  }

  const deleteEnquiry = async (enquiry) => {
    if (!canChangeEnquiry(enquiry)) return
    if (!window.confirm(`Delete enquiry "${enquiry.name}" permanently?`)) return
    try {
      await enquiriesAPI.delete(enquiry._id)
      toast.success('Enquiry deleted')
      if (editing?._id === enquiry._id) closeEdit()
      fetchData()
      window.dispatchEvent(new Event('enquiry-follow-ups-changed'))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete enquiry')
    }
  }

  const saveFollowUp = async (data) => {
    if (!followUpEnquiryId) return false
    setSavingFollowUp(true)
    try {
      const response = await enquiriesAPI.addFollowUp(followUpEnquiryId, data)
      setEnquiries((items) => items.map((item) => item._id === followUpEnquiryId ? response.data.data : item))
      toast.success(response.data.message || 'Follow-up saved.')
      window.dispatchEvent(new Event('enquiry-follow-ups-changed'))
      return true
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the note. Please try again.')
      return false
    } finally {
      setSavingFollowUp(false)
    }
  }

  const dueCounts = enquiries.reduce((counts, enquiry) => {
    const state = followUpState(enquiry, today)
    if (state === 'today' || state === 'overdue' || state === 'upcoming') counts[state] += 1
    return counts
  }, { today: 0, overdue: 0, upcoming: 0 })
  const followUpEnquiry = enquiries.find((enquiry) => enquiry._id === followUpEnquiryId)

  const dueLabel = (enquiry) => {
    const state = followUpState(enquiry, today)
    if (state === 'converted' || state === 'closed') return null
    if (state === 'none') return <span className="enquiry-due-label follow-up-none">No follow-up date</span>
    return <span className={`enquiry-due-label follow-up-${state}`}>
      {state === 'today' ? 'Follow up today' : state === 'overdue' ? 'Follow-up date passed' : 'Next follow-up'}: {formatFollowUpDate(enquiry.nextFollowUpDate)}
    </span>
  }

  const enquiryStatus = enquiry => {
    const status = isConvertedEnquiry(enquiry) ? 'converted' : enquiry.status
    const badge = status === 'new' ? 'badge-sun' : status === 'contacted' ? 'badge-blue' : status === 'converted' ? 'badge-green' : 'badge-gray'
    return <span className={`badge ${badge}`}>{status}</span>
  }
  const receivedDate = enquiry => enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString('en-IN') : '-'
  const renderActions = enquiry => (
    <EnquiryListActions enquiry={enquiry} canChange={canChangeEnquiry(enquiry)} canConvert={canConvertEnquiry(enquiry)}
      convertingId={convertingId} onFollowUp={setFollowUpEnquiryId} onConvert={convert}
      onView={item => setDetailsId(item._id)} onEdit={openEdit} onDelete={deleteEnquiry} />
  )
  const detailEnquiry = enquiries.find(enquiry => enquiry._id === detailsId)

  const filteredEnquiries = enquiries
    .filter((enquiry) => {
      if (conversionFilter === 'not-converted' && isConvertedEnquiry(enquiry)) return false
      if (conversionFilter === 'converted' && !isConvertedEnquiry(enquiry)) return false
      const dueState = followUpState(enquiry, today)
      if (followUpFilter === 'due' && !['today', 'overdue'].includes(dueState)) return false
      if (followUpFilter !== 'all' && followUpFilter !== 'due' && dueState !== followUpFilter) return false
      const q = search.toLowerCase()
      if (!q) return true
      return enquiry.name?.toLowerCase().includes(q) || String(enquiry.contact || enquiry.phone || '').includes(q) || enquiry.ivrsNo?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'due') return (a.nextFollowUpDate || '9999-12-31').localeCompare(b.nextFollowUpDate || '9999-12-31')
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'number-asc') return String(a.contact || a.phone || '').localeCompare(String(b.contact || b.phone || ''))
      if (sortBy === 'number-desc') return String(b.contact || b.phone || '').localeCompare(String(a.contact || a.phone || ''))
      if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })

  const hasActiveFilters = search.trim() !== '' || sortBy !== 'latest' || conversionFilter !== DEFAULT_CONVERSION_FILTER || followUpFilter !== 'all'

  const resetFilters = () => {
    setSearch('')
    setConversionFilter(DEFAULT_CONVERSION_FILTER)
    setFollowUpFilter('all')
    setSortBy('latest')
  }

  if (loading) return <Spinner />

  return (
    <div className={embedded ? 'compact-list-region enquiries-list-region' : 'dashboard-page compact-list-region enquiries-list-region'}>
      <PageHeader icon={<FaBell />} title={isExecutive ? 'Enquiries' : 'Website Enquiries'} subtitle={`${filteredEnquiries.length} enquiries visible for ${user?.role || 'your role'}`}
        action={!embedded ? <button type="button" className="btn btn-primary" onClick={() => setShowEnquiryForm(true)}>Enquiry Form</button> : undefined} />

      <div className="enquiry-due-overview" aria-label="Enquiry follow-ups">
        <button type="button" className={`enquiry-due-card follow-up-overdue ${followUpFilter === 'overdue' ? 'active' : ''}`}
          onClick={() => { setConversionFilter(DEFAULT_CONVERSION_FILTER); setFollowUpFilter('overdue'); setSortBy('due') }}>
          <strong>{dueCounts.overdue}</strong><span>Date passed</span><small>Follow up with these customers</small>
        </button>
        <button type="button" className={`enquiry-due-card follow-up-today ${followUpFilter === 'today' ? 'active' : ''}`}
          onClick={() => { setConversionFilter(DEFAULT_CONVERSION_FILTER); setFollowUpFilter('today'); setSortBy('due') }}>
          <strong>{dueCounts.today}</strong><span>Follow up today</span><small>{formatFollowUpDate(today)}</small>
        </button>
        <button type="button" className={`enquiry-due-card follow-up-upcoming ${followUpFilter === 'upcoming' ? 'active' : ''}`}
          onClick={() => { setConversionFilter(DEFAULT_CONVERSION_FILTER); setFollowUpFilter('upcoming'); setSortBy('due') }}>
          <strong>{dueCounts.upcoming}</strong><span>Coming up</span><small>Follow up on a later date</small>
        </button>
      </div>

      <div className="dashboard-table-filters" style={{ marginBottom:16 }}>
        <div className="dashboard-search">
          <input className="crm-input" placeholder="Search name, phone or IVRS..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="crm-input" aria-label="Conversion status" style={{ width:'auto' }} value={conversionFilter} onChange={(e) => setConversionFilter(e.target.value)}>
          <option value="not-converted">Not Converted</option>
          <option value="converted">Converted</option>
          <option value="all">All</option>
        </select>
        <select className="crm-input" aria-label="Follow-up date" style={{ width:'auto' }} value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value)}>
          <option value="all">All follow-ups</option>
          <option value="due">Today and past dates</option>
          <option value="today">Follow up today</option>
          <option value="overdue">Past follow-up dates</option>
          <option value="upcoming">Coming up</option>
          <option value="none">No follow-up date</option>
        </select>
        <select className="crm-input" style={{ width:'auto' }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="due">Follow-up date</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="number-asc">Number 0-9</option>
          <option value="number-desc">Number 9-0</option>
        </select>
        <span style={{ fontSize:12, color:'var(--muted)' }}>{filteredEnquiries.length} enquiries</span>
        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={resetFilters}>Reset filters</button>
        )}
      </div>

      {error && (
        <div className="crm-card" style={{ marginBottom:16, borderColor:'var(--red)', color:'var(--red)' }}>
          {error}
        </div>
      )}

      <div className="crm-table-wrap compact-table-wrap">
        <table className="crm-table compact-dashboard-table compact-enquiries-table">
          <thead><tr>{['Customer', 'Location', 'Enquiry', 'Status', 'Received', 'Actions'].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {filteredEnquiries.map(enquiry => (
              <tr key={enquiry._id}>
                <td>
                  <div className="compact-cell-text"><strong>{enquiry.name}</strong>
                    <div className="compact-secondary">{enquiry.contact || enquiry.phone || '-'}</div>
                    {enquiry.email && <div className="compact-secondary">{enquiry.email}</div>}
                  </div>
                </td>
                <td><div>{enquiry.city || '-'}</div><div className="compact-secondary">{[enquiry.state, enquiry.pincode].filter(Boolean).join(' / ') || '-'}</div></td>
                <td>
                  <span className={`badge ${enquiry.enquiryType === 'Service Enquiry' ? 'badge-green' : 'badge-indigo'}`}>{enquiry.enquiryType || '-'}</span>
                  <div className="compact-secondary">IVRS: {enquiry.ivrsNo || '-'}</div>
                </td>
                <td>
                  {enquiryStatus(enquiry)}{dueLabel(enquiry)}
                  {enquiry.enquiryType === 'Service Enquiry' && <div className="compact-secondary">Service Queue</div>}
                </td>
                <td className="compact-secondary">{receivedDate(enquiry)}</td>
                <td>{renderActions(enquiry)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="crm-mobile-cards">
          {filteredEnquiries.map(enquiry => (
            <div key={enquiry._id} className="crm-mobile-card">
              <div className="dashboard-split-row" style={{ marginBottom: 10 }}>
                <div><strong>{enquiry.name}</strong><div className="compact-secondary">{enquiry.contact || enquiry.phone || '-'}</div>{enquiry.email && <div className="compact-secondary">{enquiry.email}</div>}</div>
                {enquiryStatus(enquiry)}
              </div>
              {dueLabel(enquiry)}
              {[
                ['Location', [enquiry.city, enquiry.state, enquiry.pincode].filter(Boolean).join(' / ') || '-'],
                ['Enquiry', enquiry.enquiryType || '-'],
                ['IVRS No.', enquiry.ivrsNo || '-'],
                ['Received', receivedDate(enquiry)],
              ].map(([label, value]) => <div key={label} className="crm-mobile-row"><span className="crm-mobile-label">{label}</span><span>{value}</span></div>)}
              {enquiry.enquiryType === 'Service Enquiry' && <div className="compact-secondary">Service Queue</div>}
              <div className="enquiry-mobile-actions">{renderActions(enquiry)}</div>
            </div>
          ))}
        </div>

        {!error && filteredEnquiries.length === 0 && (
          <EmptyState
            icon={<FaBell />}
            title={enquiries.length === 0 ? 'No enquiries yet' : followUpFilter !== 'all' ? 'No enquiries for this follow-up date' : conversionFilter === DEFAULT_CONVERSION_FILTER && !search.trim() ? 'No enquiries without a lead' : 'No enquiries found'}
            subtitle={enquiries.length === 0 ? 'New enquiries will appear here after someone fills out the form.' : 'Choose another filter or change your search to see more enquiries.'}
          />
        )}
      </div>

      {detailEnquiry && <EnquiryDetailsModal enquiry={detailEnquiry} onClose={() => setDetailsId('')} />}

      {createPortal(<>
      {showEnquiryForm && <EnquiryFormModal onClose={() => setShowEnquiryForm(false)} onSubmitted={() => { setShowEnquiryForm(false); fetchData() }} />}

      {followUpEnquiry && <EnquiryFollowUpModal key={followUpEnquiryId} enquiry={followUpEnquiry} today={today}
        saving={savingFollowUp} onClose={() => setFollowUpEnquiryId('')} onSave={saveFollowUp} />}

      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && requestExit(closeEdit)}>
          <div className="modal-box form-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-enquiry-title">
            <div className="form-dialog-header">
              <h2 id="edit-enquiry-title" style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Edit Enquiry</h2>
              <button type="button" disabled={saving} aria-label="Close enquiry" onClick={() => requestExit(closeEdit)} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
            </div>

            <form id="enquiry-details-edit" ref={feedback.formRef} className="form-dialog-body" noValidate onSubmit={event => { event.preventDefault(); if (!saving) saveEdit() }}>
            <fieldset className="form-fieldset" disabled={saving}>
            <FormFields kind="enquiry" errors={feedback.errors} clearError={feedback.clearError}>
              <div>
                <label className="form-label">Name</label>
                <input className="crm-input" name="name" value={editForm.name} onChange={e => updateField('name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Contact</label>
                <input className="crm-input" name="contact" value={editForm.contact} onChange={e => updateField('contact', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="form-label">IVRS No. (optional)</label>
                <input className="crm-input" name="ivrsNo" value={editForm.ivrsNo} onChange={e => updateField('ivrsNo', e.target.value)} maxLength={15} placeholder="Up to 15 letters or digits" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="crm-input" type="email" name="email" value={editForm.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Enquiry Type</label>
                <SearchableSelect
                  name="enquiryType"
                  value={editForm.enquiryType}
                  onChange={(value) => updateField('enquiryType', value)}
                  options={toOptions(ENQUIRY_TYPES)}
                  placeholder="Select enquiry type..."
                  searchPlaceholder="Search enquiry type..."
                />
              </div>
              <div>
                <label className="form-label">State</label>
                <SearchableSelect
                  name="state"
                  value={editForm.state}
                  onChange={(value) => updateField('state', value)}
                  options={toOptions(STATE_OPTIONS)}
                  placeholder="Select state..."
                  searchPlaceholder="Search state..."
                />
              </div>
              <div>
                <label className="form-label">City</label>
                <SearchableSelect
                  name="city"
                  value={editForm.city}
                  onChange={(value) => updateField('city', value)}
                  options={toOptions(getCitiesForState(editForm.state))}
                  placeholder={editForm.state ? 'Select city...' : 'Select state first'}
                  searchPlaceholder="Search city..."
                  noOptionsText={editForm.state ? 'No cities found' : 'Select state first'}
                  disabled={!editForm.state}
                />
              </div>
              <div>
                <label className="form-label">Pincode</label>
                <input className="crm-input" name="pincode" value={editForm.pincode} onChange={e => updateField('pincode', e.target.value)} maxLength={6} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="crm-input" name="status" value={editForm.status} onChange={e => updateField('status', e.target.value)}>
                  {ENQUIRY_STATUSES.filter(status => !isExecutive || status !== 'converted').map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            <div style={{ marginTop:14 }}>
              <label className="form-label">Address</label>
              <textarea className="crm-input" rows={3} name="address" value={editForm.address} onChange={e => updateField('address', e.target.value)} />
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Notes</label>
              <textarea className="crm-input" rows={3} name="notes" value={editForm.notes} onChange={e => updateField('notes', e.target.value)} />
            </div>

            </FormFields>
            </fieldset>
            </form>
            <FormActions busy={saving} onCancel={() => requestExit(closeEdit)} form="enquiry-details-edit" />
          </div>
        </div>
      )}
      </>, document.body)}
    </div>
  )
}
