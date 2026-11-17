import { useEffect, useId, useState } from 'react'
import toast from 'react-hot-toast'
import { enquiriesAPI } from '../../services/api'
import { ENQUIRY_TYPES, getCitiesForState, STATE_OPTIONS } from '../../utils/constants'
import { SearchableSelect } from '../common'
import { CONTACT_PHONE_REGEX, CONTACT_PHONE_MESSAGE, normalizeContactPhone } from '../../utils/contactValidation'
import { FormFields } from '../common/FormLayout'
import { hasFormChanges, useFormFeedback } from '../../hooks/useFormEditing'

const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const CAPITALIZED_FIELDS = new Set(['name', 'address', 'state', 'city'])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)

export default function EnquiryForm({ compact = false, onSubmitted, onStateChange, formId }) {
  const emptyForm = {
    name: '',
    contact: '',
    ivrsNo: '',
    email: '',
    address: '',
    enquiryType: 'Sales Enquiry',
    state: '',
    city: '',
    pincode: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const generatedId = useId()
  const feedback = useFormFeedback()
  const dirty = !sent && hasFormChanges(form, emptyForm)
  useEffect(() => { onStateChange?.({ dirty, busy: loading, sent }) }, [dirty, loading, sent, onStateChange])

  const setField = (key, value) => setForm(prev => {
    const nextValue = CAPITALIZED_FIELDS.has(key) ? capitalizeFirstLetter(value) : value
    if (key === 'state') return { ...prev, state: nextValue, city: '' }
    if (key === 'contact') return { ...prev, contact: normalizeContactPhone(value) }
    if (key === 'pincode') return { ...prev, pincode: String(value || '').replace(/\D/g, '').slice(0, 6) }
    if (key === 'ivrsNo') return { ...prev, ivrsNo: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) }
    return { ...prev, [key]: nextValue }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!CONTACT_PHONE_REGEX.test(form.contact)) errors.contact = CONTACT_PHONE_MESSAGE
    if (!form.enquiryType) errors.enquiryType = 'Please select an enquiry type.'
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) errors.pincode = 'Pincode must contain exactly 6 digits.'
    if (Object.keys(errors).length) return feedback.report(errors)
    feedback.resetErrors()
    setLoading(true)
    try {
      await enquiriesAPI.create(form)
      onSubmitted?.()
      setSent(true)
      toast.success('Enquiry submitted successfully.')
      setTimeout(() => {
        setSent(false)
        setForm(emptyForm)
      }, 4000)
    } catch (error) {
      feedback.reportApi(error, 'Failed to submit enquiry. Please try again.')
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
    <div className={compact ? 'form-dialog-body' : ''} style={compact ? undefined : { background:'linear-gradient(135deg,var(--card),var(--card2))', border:'1px solid rgba(245,158,11,.2)', borderRadius:20, padding:32, maxWidth:560 }}>
      {!compact && (
        <>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, marginBottom:6 }}>Send Us Your Enquiry</h3>
          <p style={{ fontSize:14, color:'var(--muted)', marginBottom:24 }}>Our team will contact you about your solar enquiry.</p>
        </>
      )}

      <form id={formId || generatedId} ref={feedback.formRef} noValidate onSubmit={handleSubmit}>
        <fieldset disabled={loading} className="form-fieldset">
        <FormFields kind="enquiry" errors={feedback.errors} clearError={feedback.clearError}>
          <div>
            <label className="form-label">Name *</label>
            <input className="crm-input" placeholder="Your name" name="name" value={form.name} onChange={e => setField('name', e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Contact *</label>
            <input className="crm-input" placeholder="10-digit contact number" name="contact" value={form.contact} onChange={e => setField('contact', e.target.value)} maxLength={10} required />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="crm-input" type="email" placeholder="you@example.com" name="email" value={form.email} onChange={e => setField('email', e.target.value)} />
          </div>
          <div>
            <label className="form-label">IVRS No. (optional)</label>
            <input className="crm-input" name="ivrsNo" value={form.ivrsNo} onChange={e => setField('ivrsNo', e.target.value)} maxLength={15} placeholder="Up to 15 letters or digits" />
          </div>
          <div>
            <label className="form-label">Enquiry Type *</label>
            <SearchableSelect
              name="enquiryType"
              value={form.enquiryType}
              onChange={(value) => setField('enquiryType', value)}
              options={toOptions(ENQUIRY_TYPES)}
              placeholder="Select enquiry type..."
              searchPlaceholder="Search enquiry type..."
              required
            />
          </div>
          <div>
            <label className="form-label">State</label>
            <SearchableSelect
              name="state"
              value={form.state}
              onChange={(value) => setField('state', value)}
              options={toOptions(STATE_OPTIONS)}
              placeholder="Select state..."
              searchPlaceholder="Search state..."
            />
          </div>
          <div>
            <label className="form-label">City</label>
            <SearchableSelect
              name="city"
              value={form.city}
              onChange={(value) => setField('city', value)}
              options={toOptions(getCitiesForState(form.state))}
              placeholder={form.state ? 'Select city...' : 'Select state first'}
              searchPlaceholder="Search city..."
              noOptionsText={form.state ? 'No cities found' : 'Select state first'}
              disabled={!form.state}
            />
          </div>
          <div className="full">
            <label className="form-label">Address</label>
            <textarea className="crm-input" rows={compact ? 2 : 3} placeholder="Full address" name="address" value={form.address} onChange={e => setField('address', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Pincode</label>
            <input className="crm-input" placeholder="6-digit pincode" name="pincode" value={form.pincode} onChange={e => setField('pincode', e.target.value)} maxLength={6} />
          </div>
        </FormFields>
        </fieldset>

        {!compact && <button
          type="submit"
          className="btn btn-primary"
          style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:16, fontSize:14 }}
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Enquiry'}
        </button>}
      </form>
    </div>
  )
}
