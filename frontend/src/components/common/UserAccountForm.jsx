import useOfficeOptions from '../../hooks/useOfficeOptions'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FilePreview, SearchableSelect } from '../common'
import { getCitiesForState, STATE_OPTIONS } from '../../utils/constants'
import { hasFormChanges } from '../../hooks/useFormEditing'
import { accountRoles, normalizeAccountPhone, normalizeAccountEmail, todayAccountDate, validateAccountForm } from '../../utils/userAccount'

const emptyRegisterForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  permanentAddress: '',
  address: '',
  alternateContact: '',
  state: '',
  city: '',
  pincode: '',
  office: '',
  documents: null,
  dateOfJoining: '',
  role: 'Sales Executive',
}

const CAPITALIZED_REGISTER_FIELDS = new Set([
  'name',
  'permanentAddress',
  'address',
  'state',
  'city',
])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)

const toOptions = items => items.map(value => ({ value, label: value }))

export default function UserAccountForm({ admin = false, defaultRole = 'Sales Executive', onSubmit, onBusyChange, onCancel, initialUser = null, allowRoleChange = true, onDirtyChange }) {
  const { offices, loading: officesLoading, error: officeError } = useOfficeOptions()
  const editing = Boolean(initialUser)
  const baseline = useRef(initialUser ? {
    ...emptyRegisterForm,
    ...Object.fromEntries(Object.keys(emptyRegisterForm).filter(key => !['password', 'documents', 'dateOfJoining'].includes(key)).map(key => [key, initialUser[key] ?? emptyRegisterForm[key]])),
    password: '', documents: null, dateOfJoining: initialUser.dateOfJoining ? String(initialUser.dateOfJoining).slice(0, 10) : '',
  } : { ...emptyRegisterForm, role: defaultRole, dateOfJoining: todayAccountDate() })
  const [registerForm, setRegisterForm] = useState(baseline.current)
  useEffect(() => {
    if (editing || !offices.length) return
    const office = admin ? localStorage.getItem('solar_office') : offices.find(item => item.code === 'RTM')?._id || offices[0]._id
    baseline.current = { ...baseline.current, office }
    setRegisterForm(previous => ({ ...previous, office }))
  }, [offices, editing, admin])
  const dirty = hasFormChanges(registerForm, baseline.current)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const [saving, setSaving] = useState(false)
  const setRegisterField = (key, value) => {
    const nextValue = CAPITALIZED_REGISTER_FIELDS.has(key) ? capitalizeFirstLetter(value) : value
    setRegisterForm((prev) => {
      if (key === 'state') {
        return { ...prev, state: nextValue, city: '' }
      }
      return { ...prev, [key]: nextValue }
    })
  }

  const submit = async event => {
    event.preventDefault()
    if (saving) return
    const validationError = validateAccountForm(registerForm, admin, editing)
    if (!registerForm.office) { toast.error('Please select an office.'); return }
    if (validationError) { toast.error(validationError); return }
    setSaving(true)
    onBusyChange?.(true)
    try {
      await onSubmit(registerForm)
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.message || error.response?.data?.message || (editing ? 'Unable to update user. Please try again.' : 'Unable to create account. Please try again.'))
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  return (
    <form onSubmit={submit} className={editing ? 'user-account-edit-form' : undefined}>
      <div className={editing ? 'user-account-edit-scroll' : undefined}>
      <fieldset disabled={saving} className={editing ? 'user-account-edit-fields' : undefined} style={{ border:0, padding:0, margin:0, minWidth:0 }}>
        <div className="dashboard-form-grid" style={{ gap:12 }}>
          <div>
            <label className="form-label">Name</label>
            <input aria-label="Name" className="crm-input" value={registerForm.name} onChange={(e) => setRegisterField('name', e.target.value)} required />
          </div>

          <div>
            <label className="form-label">Contact</label>
            <input aria-label="Contact" className="crm-input" value={registerForm.phone} onChange={(e) => setRegisterField('phone', normalizeAccountPhone(e.target.value))} maxLength={10} placeholder="10-digit number" required />
          </div>

          <div>
            <label className="form-label">Alternate Contact</label>
            <input aria-label="Alternate Contact" className="crm-input" value={registerForm.alternateContact} onChange={(e) => setRegisterField('alternateContact', normalizeAccountPhone(e.target.value))} maxLength={10} placeholder="10-digit number" />
          </div>

          <div>
            <label className="form-label">Email Address</label>
            <input aria-label="Email Address" className="crm-input" type="email" value={registerForm.email} onChange={(e) => setRegisterField('email', e.target.value)} onBlur={(e) => setRegisterField('email', normalizeAccountEmail(e.target.value))} required />
          </div>

          {!editing && <div>
            <label className="form-label">Password</label>
            <input className="crm-input" type="password" autoComplete="new-password" minLength={6} value={registerForm.password} onChange={(e) => setRegisterField('password', e.target.value)} required />
          </div>}

          <div style={editing ? undefined : { gridColumn:'1 / -1' }}>
            <label className="form-label">Role</label>
            <SearchableSelect
disabled={saving || !allowRoleChange}
name="role"
              value={registerForm.role}
              onChange={(value) => setRegisterField('role', value)}
              options={toOptions(accountRoles(admin))}
              placeholder="Select role..."
              searchPlaceholder="Search role..."
              required
            />
          </div>

          <div>
            <label className="form-label">Permanent Address</label>
            <input aria-label="Permanent Address" className="crm-input" value={registerForm.permanentAddress} onChange={(e) => setRegisterField('permanentAddress', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Address</label>
            <input aria-label="Address" className="crm-input" value={registerForm.address} onChange={(e) => setRegisterField('address', e.target.value)} />
          </div>

          <div>
            <label className="form-label">State</label>
            <SearchableSelect
disabled={saving}
name="state"
              value={registerForm.state}
              onChange={(value) => setRegisterField('state', value)}
              options={toOptions(STATE_OPTIONS)}
              placeholder="Select state..."
              searchPlaceholder="Search state..."
            />
          </div>

          <div>
            <label className="form-label">City</label>
            <SearchableSelect
name="city"
              value={registerForm.city}
              onChange={(value) => setRegisterField('city', value)}
              options={toOptions(getCitiesForState(registerForm.state))}
              placeholder={registerForm.state ? 'Select city...' : 'Select state first'}
              searchPlaceholder="Search city..."
              noOptionsText={registerForm.state ? 'No cities found' : 'Select state first'}
              disabled={saving || !registerForm.state}
            />
          </div>

          <div>
            <label className="form-label">Pincode</label>
            <input aria-label="Pincode" className="crm-input" value={registerForm.pincode} onChange={(e) => setRegisterField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
          </div>

          <div>
            <label className="form-label">Date of Joining</label>
            <input aria-label="Date of Joining" className="crm-input" type="date" value={registerForm.dateOfJoining} onChange={(e) => setRegisterField('dateOfJoining', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Office *</label>
            <SearchableSelect name="office" value={registerForm.office?._id || registerForm.office} onChange={value => setRegisterField('office', value)} options={offices.map(item => ({ value:item._id, label:item.name }))} disabled={admin || editing || officesLoading} required placeholder="Select office..." searchPlaceholder="Search offices..." />
            {officeError && <p role="alert">{officeError}</p>}
          </div>

          <div style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Documents</label>
            <input
              className="crm-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setRegisterField('documents', e.target.files?.[0] || null)}
            />
            {editing && !registerForm.documents && (initialUser.documentsFile || initialUser.documents) && <div style={{ marginTop:8 }}><FilePreview file={initialUser.documentsFile || initialUser.documents} label="Current document" compact /></div>}
            {registerForm.documents && (
              <div style={{ marginTop:8 }}>
                <FilePreview file={registerForm.documents} label="Selected document" compact />
              </div>
            )}
          </div>
        </div>
      </fieldset>
      </div>
      <div className={`dashboard-inline-actions ${editing ? 'user-account-edit-actions' : ''}`} style={{ marginTop:16 }}>
        {onCancel && <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" style={{ flex:1, justifyContent:'center', padding:13, fontSize:15 }} disabled={saving || (editing && !dirty)}>
          {saving ? (editing ? 'Saving changes...' : 'Creating account...') : editing ? 'Save Changes' : admin ? 'Create User' : 'Register'}
        </button>
      </div>
    </form>
  )
}
