import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { EmptyState, PageHeader, Spinner } from '../../components/common'
import { enquiriesAPI } from '../../services/api'
import { useAuthStore } from '../../store'

const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']
const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'closed']
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

export default function EnquiriesPage() {
  const { user } = useAuthStore()
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)

  const canEdit = user?.role === 'Admin'
  const canConvert = ['Admin', 'Manager', 'Sales Manager'].includes(user?.role)

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
  }, [])

  const convert = async (id) => {
    try {
      await enquiriesAPI.convertToLead(id)
      toast.success('Lead created from enquiry.')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert enquiry')
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

  const updateField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }))

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

  if (loading) return <Spinner />

  return (
    <div className="dashboard-page">
      <PageHeader icon="📩" title="Website Enquiries" subtitle={`${enquiries.length} enquiries visible for ${user?.role || 'your role'}`} />

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
            {enquiries.map(enquiry => (
              <tr key={enquiry._id}>
                <td style={{ fontWeight:500 }}>{enquiry.name}</td>
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
                    {canConvert && enquiry.enquiryType !== 'Service Enquiry' && !enquiry.convertedTo && (
                      <button className="btn btn-success btn-sm" onClick={() => convert(enquiry._id)}>Create Lead</button>
                    )}
                    {enquiry.convertedTo && <span className="badge badge-green">Converted</span>}
                    {enquiry.enquiryType === 'Service Enquiry' && <span className="badge badge-blue">Service Queue</span>}
                    {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(enquiry)}>Edit</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="crm-mobile-cards">
          {enquiries.map(enquiry => (
            <div key={enquiry._id} className="crm-mobile-card">
              <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{enquiry.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{enquiry.contact || enquiry.phone || '-'}</div>
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
                {canConvert && enquiry.enquiryType !== 'Service Enquiry' && !enquiry.convertedTo && (
                  <button className="btn btn-success btn-sm" onClick={() => convert(enquiry._id)}>Create Lead</button>
                )}
                {enquiry.convertedTo && <span className="badge badge-green">Converted</span>}
                {enquiry.enquiryType === 'Service Enquiry' && <span className="badge badge-blue">Service Queue</span>}
                {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(enquiry)}>Edit</button>}
              </div>
            </div>
          ))}
        </div>

        {!error && enquiries.length === 0 && (
          <EmptyState icon="📩" title="No enquiries yet" subtitle="Website enquiries will appear here as soon as customers submit the form." />
        )}
      </div>

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
                <input className="crm-input" value={editForm.contact} onChange={e => updateField('contact', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="crm-input" type="email" value={editForm.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Enquiry Type</label>
                <select className="crm-input" value={editForm.enquiryType} onChange={e => updateField('enquiryType', e.target.value)}>
                  <option value="">Select enquiry type...</option>
                  {ENQUIRY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">State</label>
                <input className="crm-input" value={editForm.state} onChange={e => updateField('state', e.target.value)} />
              </div>
              <div>
                <label className="form-label">City</label>
                <input className="crm-input" value={editForm.city} onChange={e => updateField('city', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Pincode</label>
                <input className="crm-input" value={editForm.pincode} onChange={e => updateField('pincode', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="crm-input" value={editForm.status} onChange={e => updateField('status', e.target.value)}>
                  {ENQUIRY_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
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
