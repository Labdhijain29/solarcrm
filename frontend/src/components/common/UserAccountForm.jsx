import { useState } from 'react'
import toast from 'react-hot-toast'
import { FilePreview, SearchableSelect } from '../common'
import { getCitiesForState, getSubDistrictOptions, STATE_OPTIONS } from '../../utils/constants'
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
  franchiseEnabled: false,
  franchiseName: '',
  franchiseState: '',
  franchiseCity: '',
  franchiseSubDistrict: '',
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
  'franchiseName',
  'franchiseState',
  'franchiseCity',
  'franchiseSubDistrict',
])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)

const toOptions = items => items.map(value => ({ value, label: value }))

export default function UserAccountForm({ admin = false, defaultRole = 'Sales Executive', onSubmit, onBusyChange, onCancel }) {
  const [registerForm, setRegisterForm] = useState(() => ({ ...emptyRegisterForm, role: defaultRole, dateOfJoining: todayAccountDate() }))
  const [saving, setSaving] = useState(false)
  const setRegisterField = (key, value) => {
    const nextValue = CAPITALIZED_REGISTER_FIELDS.has(key) ? capitalizeFirstLetter(value) : value
    setRegisterForm((prev) => {
      if (key === 'state') {
        return { ...prev, state: nextValue, city: '' }
      }
      if (key === 'franchiseEnabled') {
        if (nextValue) return { ...prev, franchiseEnabled: true }
        return {
          ...prev,
          franchiseEnabled: false,
          franchiseName: '',
          franchiseState: '',
          franchiseCity: '',
          franchiseSubDistrict: '',
        }
      }
      if (key === 'franchiseState') {
        return { ...prev, franchiseState: nextValue, franchiseCity: '', franchiseSubDistrict: '' }
      }
      if (key === 'franchiseCity') {
        return { ...prev, franchiseCity: nextValue, franchiseSubDistrict: '' }
      }
      return { ...prev, [key]: nextValue }
    })
  }

  const submit = async event => {
    event.preventDefault()
    if (saving) return
    const validationError = validateAccountForm(registerForm, admin)
    if (validationError) { toast.error(validationError); return }
    setSaving(true)
    onBusyChange?.(true)
    try {
      await onSubmit(registerForm)
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.message || error.response?.data?.message || 'Unable to create account. Please try again.')
    } finally {
      setSaving(false)
      onBusyChange?.(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={saving} style={{ border:0, padding:0, margin:0, minWidth:0 }}>
        <div className="dashboard-form-grid" style={{ gap:12 }}>
          <div>
            <label className="form-label">Name</label>
            <input className="crm-input" value={registerForm.name} onChange={(e) => setRegisterField('name', e.target.value)} required />
          </div>

          <div>
            <label className="form-label">Contact</label>
            <input className="crm-input" value={registerForm.phone} onChange={(e) => setRegisterField('phone', normalizeAccountPhone(e.target.value))} maxLength={10} placeholder="10-digit number" required />
          </div>

          <div>
            <label className="form-label">Alternate Contact</label>
            <input className="crm-input" value={registerForm.alternateContact} onChange={(e) => setRegisterField('alternateContact', normalizeAccountPhone(e.target.value))} maxLength={10} placeholder="10-digit number" />
          </div>

          <div>
            <label className="form-label">Email Address</label>
            <input className="crm-input" type="email" value={registerForm.email} onChange={(e) => setRegisterField('email', e.target.value)} onBlur={(e) => setRegisterField('email', normalizeAccountEmail(e.target.value))} required />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input className="crm-input" type="password" autoComplete="new-password" minLength={6} value={registerForm.password} onChange={(e) => setRegisterField('password', e.target.value)} required />
          </div>

          <div style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Role</label>
            <SearchableSelect
disabled={saving}
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
            <input className="crm-input" value={registerForm.permanentAddress} onChange={(e) => setRegisterField('permanentAddress', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Address</label>
            <input className="crm-input" value={registerForm.address} onChange={(e) => setRegisterField('address', e.target.value)} />
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
            <input className="crm-input" value={registerForm.pincode} onChange={(e) => setRegisterField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
          </div>

          <div>
            <label className="form-label">Date of Joining</label>
            <input className="crm-input" type="date" value={registerForm.dateOfJoining} onChange={(e) => setRegisterField('dateOfJoining', e.target.value)} />
          </div>

          <div style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Franchise</label>
            <select className="crm-input" value={registerForm.franchiseEnabled ? 'yes' : 'no'} onChange={(e) => setRegisterField('franchiseEnabled', e.target.value === 'yes')}>
              <option value="no">No Franchise</option>
              <option value="yes">Franchise Required</option>
            </select>
          </div>

          {registerForm.franchiseEnabled && (
            <>
              <div>
                <label className="form-label">Franchise Name</label>
                <input className="crm-input" value={registerForm.franchiseName} onChange={(e) => setRegisterField('franchiseName', e.target.value)} />
              </div>

              <div>
                <label className="form-label">Franchise State</label>
                <SearchableSelect
disabled={saving}
name="franchiseState"
                  value={registerForm.franchiseState}
                  onChange={(value) => setRegisterField('franchiseState', value)}
                  options={toOptions(STATE_OPTIONS)}
                  placeholder="Select state..."
                  searchPlaceholder="Search state..."
                />
              </div>

              <div>
                <label className="form-label">Franchise City</label>
                <SearchableSelect
name="franchiseCity"
                  value={registerForm.franchiseCity}
                  onChange={(value) => setRegisterField('franchiseCity', value)}
                  options={toOptions(getCitiesForState(registerForm.franchiseState))}
                  placeholder={registerForm.franchiseState ? 'Select city...' : 'Select state first'}
                  searchPlaceholder="Search city..."
                  noOptionsText={registerForm.franchiseState ? 'No cities found' : 'Select state first'}
                  disabled={saving || !registerForm.franchiseState}
                />
              </div>

              <div>
                <label className="form-label">Franchise Sub-District</label>
                <SearchableSelect
name="franchiseSubDistrict"
                  value={registerForm.franchiseSubDistrict}
                  onChange={(value) => setRegisterField('franchiseSubDistrict', value)}
                  options={toOptions(getSubDistrictOptions(registerForm.franchiseCity))}
                  placeholder={registerForm.franchiseCity ? 'Select sub-district...' : 'Select city first'}
                  searchPlaceholder="Search sub-district..."
                  noOptionsText={registerForm.franchiseCity ? 'No sub-districts found' : 'Select city first'}
                  disabled={saving || !registerForm.franchiseCity}
                />
              </div>
            </>
          )}

          <div style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Documents</label>
            <input
              className="crm-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setRegisterField('documents', e.target.files?.[0] || null)}
            />
            {registerForm.documents && (
              <div style={{ marginTop:8 }}>
                <FilePreview file={registerForm.documents} label="Selected document" compact />
              </div>
            )}
          </div>
        </div>
      </fieldset>
      <div className="dashboard-inline-actions" style={{ marginTop:16 }}>
        {onCancel && <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" style={{ flex:1, justifyContent:'center', padding:13, fontSize:15 }} disabled={saving}>
          {saving ? 'Creating account...' : admin ? 'Create User' : 'Register'}
        </button>
      </div>
    </form>
  )
}
