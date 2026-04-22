import { useState } from 'react'
import toast from 'react-hot-toast'
import { enquiriesAPI } from '../../services/api'
import { getCitiesForState, STATE_OPTIONS } from '../../utils/constants'

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

  const setField = (key, value) => setForm(prev => {
    if (key === 'state') return { ...prev, state: value, city: '' }
    if (key === 'contact') return { ...prev, contact: String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10) }
    if (key === 'pincode') return { ...prev, pincode: String(value || '').replace(/\D/g, '').slice(0, 6) }
    return { ...prev, [key]: value }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(form.contact)) {
      toast.error('Contact number 10 digits ka valid mobile number hona chahiye.')
      return
    }
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
            <input className="crm-input" placeholder="10-digit contact number" value={form.contact} onChange={e => setField('contact', e.target.value)} maxLength={10} required />
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
            <select className="crm-input" value={form.state} onChange={e => setField('state', e.target.value)}>
              <option value="">Select state...</option>
              {STATE_OPTIONS.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">City</label>
            <select className="crm-input" value={form.city} onChange={e => setField('city', e.target.value)} disabled={!form.state}>
              <option value="">{form.state ? 'Select city...' : 'Select state first'}</option>
              {getCitiesForState(form.state).map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: compact ? 'auto' : '1 / -1' }}>
            <label className="form-label">Address</label>
            <textarea className="crm-input" rows={compact ? 2 : 3} placeholder="Full address" value={form.address} onChange={e => setField('address', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Pincode</label>
            <input className="crm-input" placeholder="6-digit pincode" value={form.pincode} onChange={e => setField('pincode', e.target.value)} maxLength={6} />
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
