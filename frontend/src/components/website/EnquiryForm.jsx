import { useState } from 'react'
import toast from 'react-hot-toast'
import { enquiriesAPI } from '../../services/api'

const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']

export default function EnquiryForm({ compact = false }) {
  const emptyForm = {
    name: '',
    contact: '',
    email: '',
    address: '',
    enquiryType: '',
    state: '',
    city: '',
    pincode: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await enquiriesAPI.create(form)
      setSent(true)
      toast.success('Enquiry submitted successfully.')
      setTimeout(() => {
        setSent(false)
        setForm(emptyForm)
      }, 4000)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit enquiry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ background:'linear-gradient(135deg,var(--card),var(--card2))', border:'1px solid rgba(245,158,11,.2)', borderRadius:20, padding: compact ? 24 : 32, textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:12 }}>OK</div>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, marginBottom:8 }}>Enquiry Submitted!</h3>
        <p style={{ fontSize:14, color:'var(--muted)' }}>Our team will review your enquiry and contact you soon.</p>
      </div>
    )
  }

  return (
    <div style={{ background:'linear-gradient(135deg,var(--card),var(--card2))', border:'1px solid rgba(245,158,11,.2)', borderRadius:20, padding: compact ? 20 : 32, maxWidth: compact ? '100%' : 560 }}>
      {!compact && (
        <>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, marginBottom:6 }}>Send Us Your Enquiry</h3>
          <p style={{ fontSize:14, color:'var(--muted)', marginBottom:24 }}>The right dashboard team will receive it based on your enquiry type.</p>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <div className="site-grid-auto-sm" style={{ gap:12 }}>
          <div>
            <label className="form-label">Name *</label>
            <input className="crm-input" placeholder="Your name" value={form.name} onChange={e => setField('name', e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Contact *</label>
            <input className="crm-input" placeholder="+91 98xxx xxxxx" value={form.contact} onChange={e => setField('contact', e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="crm-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setField('email', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Enquiry Type *</label>
            <select className="crm-input" value={form.enquiryType} onChange={e => setField('enquiryType', e.target.value)} required>
              <option value="">Select enquiry type...</option>
              {ENQUIRY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">State</label>
            <input className="crm-input" placeholder="State" value={form.state} onChange={e => setField('state', e.target.value)} />
          </div>
          <div>
            <label className="form-label">City</label>
            <input className="crm-input" placeholder="City" value={form.city} onChange={e => setField('city', e.target.value)} />
          </div>
          <div style={{ gridColumn: compact ? 'auto' : '1 / -1' }}>
            <label className="form-label">Address</label>
            <textarea className="crm-input" rows={compact ? 2 : 3} placeholder="Full address" value={form.address} onChange={e => setField('address', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Pincode</label>
            <input className="crm-input" placeholder="6-digit pincode" value={form.pincode} onChange={e => setField('pincode', e.target.value)} />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:16, fontSize:14 }}
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Enquiry'}
        </button>
      </form>
    </div>
  )
}
