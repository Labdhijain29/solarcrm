import { useEffect, useState } from 'react'
import { FaBell } from 'react-icons/fa'
import { useLocation, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { EmptyState, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import { enquiriesAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { getCitiesForState, STATE_OPTIONS } from '../../utils/constants'
import EnquiryFormModal from '../../components/dashboard/EnquiryFormModal'
import EnquiryFollowUpModal from '../../components/dashboard/EnquiryFollowUpModal'
import { formatFollowUpDate, followUpState, indiaToday, isConvertedEnquiry } from '../../utils/enquiryFollowUp'

const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']
const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'closed']
const DEFAULT_CONVERSION_FILTER = 'not-converted'
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const CAPITALIZED_FIELDS = new Set(['name', 'address', 'state', 'city', 'notes'])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)
const emptyEditForm = {
  name: '',
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
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
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
    setEditForm({
      name: enquiry.name || '',
      contact: enquiry.contact || enquiry.phone || '',
      email: enquiry.email || '',
      address: enquiry.address || '',
      enquiryType: enquiry.enquiryType || '',
      state: enquiry.state || '',
      city: enquiry.city || '',
      pincode: enquiry.pincode || '',
      status: enquiry.status || 'new',
      notes: enquiry.notes || '',
    })
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm(emptyEditForm)
  }

  const updateField = (key, value) => setEditForm(prev => {
    if (key === 'state') return { ...prev, state: value, city: '' }
    if (key === 'contact') return { ...prev, contact: String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10) }
    if (key === 'pincode') return { ...prev, pincode: String(value || '').replace(/\D/g, '').slice(0, 6) }
    if (CAPITALIZED_FIELDS.has(key)) return { ...prev, [key]: capitalizeFirstLetter(value) }
    return { ...prev, [key]: value }
  })

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await enquiriesAPI.update(editing._id, editForm)
      toast.success('Enquiry updated successfully.')
      closeEdit()
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update enquiry')
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

  const filteredEnquiries = enquiries
    .filter((enquiry) => {
      if (conversionFilter === 'not-converted' && isConvertedEnquiry(enquiry)) return false
      if (conversionFilter === 'converted' && !isConvertedEnquiry(enquiry)) return false
      const dueState = followUpState(enquiry, today)
      if (followUpFilter === 'due' && !['today', 'overdue'].includes(dueState)) return false
      if (followUpFilter !== 'all' && followUpFilter !== 'due' && dueState !== followUpFilter) return false
      const q = search.toLowerCase()
      if (!q) return true
      return enquiry.name?.toLowerCase().includes(q) || String(enquiry.contact || enquiry.phone || '').includes(q)
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
    <div className={embedded ? undefined : 'dashboard-page'}>
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
          <input className="crm-input" placeholder="Search by name or number..." value={search} onChange={(e) => setSearch(e.target.value)} />
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

      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {['Name', 'Contact', 'Email', 'Address', 'Enquiry Type', 'State', 'City', 'Pincode', 'Status', 'Received', 'Action'].map(label => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredEnquiries.map(enquiry => (
              <tr key={enquiry._id}>
                <td style={{ fontWeight:500 }}>{enquiry.name}{dueLabel(enquiry)}</td>
                <td style={{ fontSize:12 }}>{enquiry.contact || enquiry.phone || '-'}</td>
                <td style={{ fontSize:12 }}>{enquiry.email || '-'}</td>
                <td style={{ fontSize:12, maxWidth:200, whiteSpace:'normal' }}>{enquiry.address || '-'}</td>
                <td>
                  <span className={`badge ${enquiry.enquiryType === 'Service Enquiry' ? 'badge-green' : 'badge-indigo'}`}>
                    {enquiry.enquiryType || '-'}
                  </span>
                </td>
                <td><span className="badge badge-gray">{enquiry.state || '-'}</span></td>
                <td><span className="badge badge-gray">{enquiry.city || '-'}</span></td>
                <td style={{ fontSize:12 }}>{enquiry.pincode || '-'}</td>
                <td>
                  <span className={`badge ${enquiry.status === 'new' ? 'badge-sun' : enquiry.status === 'contacted' ? 'badge-blue' : enquiry.status === 'converted' ? 'badge-green' : 'badge-gray'}`}>
                    {enquiry.status}
                  </span>
                </td>
                <td style={{ fontSize:12, color:'var(--muted)' }}>
                  {enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString('en-IN') : '-'}
                </td>
                <td>
                  <div className="dashboard-inline-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFollowUpEnquiryId(enquiry._id)}>
                      {isConvertedEnquiry(enquiry) || enquiry.status === 'closed' ? 'View follow-ups' : 'Follow up'}
                    </button>
                    {canConvertEnquiry(enquiry) && (
                      <button className="btn btn-success btn-sm" disabled={Boolean(convertingId)} onClick={() => convert(enquiry._id)}>{convertingId === enquiry._id ? 'Converting...' : 'Create Lead'}</button>
                    )}
                    {enquiry.convertedTo && <span className="badge badge-green">Converted</span>}
                    {enquiry.enquiryType === 'Service Enquiry' && <span className="badge badge-blue">Service Queue</span>}
                    {canChangeEnquiry(enquiry) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(enquiry)}>Edit</button>}
                    {canChangeEnquiry(enquiry) && <button className="btn btn-danger btn-sm" onClick={() => deleteEnquiry(enquiry)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="crm-mobile-cards">
          {filteredEnquiries.map(enquiry => (
            <div key={enquiry._id} className="crm-mobile-card">
              <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{enquiry.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{enquiry.contact || enquiry.phone || '-'}</div>
                  {dueLabel(enquiry)}
                </div>
                <span className={`badge ${enquiry.status === 'new' ? 'badge-sun' : enquiry.status === 'contacted' ? 'badge-blue' : enquiry.status === 'converted' ? 'badge-green' : 'badge-gray'}`}>
                  {enquiry.status}
                </span>
              </div>

              {[
                ['Email', enquiry.email || '-'],
                ['Type', enquiry.enquiryType || '-'],
                ['State', enquiry.state || '-'],
                ['City', enquiry.city || '-'],
                ['Pincode', enquiry.pincode || '-'],
                ['Received', enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString('en-IN') : '-'],
              ].map(([label, value]) => (
                <div key={label} className="crm-mobile-row">
                  <span className="crm-mobile-label">{label}</span>
                  <span>{value}</span>
                </div>
              ))}

              <div style={{ paddingTop:8, fontSize:12, color:'var(--muted)' }}>{enquiry.address || '-'}</div>

              <div className="dashboard-inline-actions" style={{ marginTop:10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFollowUpEnquiryId(enquiry._id)}>
                  {isConvertedEnquiry(enquiry) || enquiry.status === 'closed' ? 'View follow-ups' : 'Follow up'}
                </button>
                {canConvertEnquiry(enquiry) && (
                  <button className="btn btn-success btn-sm" disabled={Boolean(convertingId)} onClick={() => convert(enquiry._id)}>{convertingId === enquiry._id ? 'Converting...' : 'Create Lead'}</button>
                )}
                {enquiry.convertedTo && <span className="badge badge-green">Converted</span>}
                {enquiry.enquiryType === 'Service Enquiry' && <span className="badge badge-blue">Service Queue</span>}
                {canChangeEnquiry(enquiry) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(enquiry)}>Edit</button>}
                {canChangeEnquiry(enquiry) && <button className="btn btn-danger btn-sm" onClick={() => deleteEnquiry(enquiry)}>Delete</button>}
              </div>
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

      {showEnquiryForm && <EnquiryFormModal onClose={() => setShowEnquiryForm(false)} onSubmitted={() => { setShowEnquiryForm(false); fetchData() }} />}

      {followUpEnquiry && <EnquiryFollowUpModal key={followUpEnquiryId} enquiry={followUpEnquiry} today={today}
        saving={savingFollowUp} onClose={() => setFollowUpEnquiryId('')} onSave={saveFollowUp} />}

      {editing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeEdit()}>
          <div className="modal-box" style={{ maxWidth:720 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Edit Enquiry</h2>
              <button onClick={closeEdit} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
            </div>

            <div className="dashboard-form-grid">
              <div>
                <label className="form-label">Name</label>
                <input className="crm-input" value={editForm.name} onChange={e => updateField('name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Contact</label>
                <input className="crm-input" value={editForm.contact} onChange={e => updateField('contact', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="crm-input" type="email" value={editForm.email} onChange={e => updateField('email', e.target.value)} />
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
                <input className="crm-input" value={editForm.pincode} onChange={e => updateField('pincode', e.target.value)} maxLength={6} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="crm-input" value={editForm.status} onChange={e => updateField('status', e.target.value)}>
                  {ENQUIRY_STATUSES.filter(status => !isExecutive || status !== 'converted').map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Address</label>
              <textarea className="crm-input" rows={3} value={editForm.address} onChange={e => updateField('address', e.target.value)} />
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Notes</label>
              <textarea className="crm-input" rows={3} value={editForm.notes} onChange={e => updateField('notes', e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:18 }} onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
