import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FaSolarPanel } from 'react-icons/fa'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { getCitiesForState, getSubDistrictOptions, STATE_OPTIONS } from '../../utils/constants'
import { FilePreview, SearchableSelect } from '../../components/common'

const REGISTER_ROLES = [
  'Manager',
  'Sales Executive',
  'Sales Manager',
  'Registration Executive',
  'Bank/Finance Executive',
  'Loan Officer',
  'Stock Manager',
  'Dispatch Manager',
  'Installation Manager',
  'Net Metering Officer',
  'Subsidy Officer',
  'Subsidy Reading Officer',
  'Service Manager',
]

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

const normalizeIndianPhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const getApiErrorMessage = (err, fallback = 'Request failed') => {
  const firstValidationError = err.response?.data?.errors?.[0]?.message
  return firstValidationError || err.response?.data?.message || err.message || fallback
}
const REMEMBER_ME_KEY = 'solar_remember_me'
const REMEMBERED_LOGIN_KEY = 'solar_remembered_login'

const getRememberedLogin = () => {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_LOGIN_KEY) || 'null')
  } catch {
    return null
  }
}

const toOptions = (items) => items.map((item) => ({ value: item, label: item }))

export default function LoginPage() {
  const rememberedLogin = getRememberedLogin()
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState(rememberedLogin?.email || '')
  const [password, setPassword] = useState(rememberedLogin?.password || '')
  const [rememberMe, setRememberMe] = useState(localStorage.getItem(REMEMBER_ME_KEY) === 'true' && !!rememberedLogin)
  const [registering, setRegistering] = useState(false)
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)

  const setRegisterField = (key, value) => {
    setRegisterForm((prev) => {
      if (key === 'state') {
        return { ...prev, state: value, city: '' }
      }
      if (key === 'franchiseEnabled') {
        if (value) return { ...prev, franchiseEnabled: true }
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
        return { ...prev, franchiseState: value, franchiseCity: '', franchiseSubDistrict: '' }
      }
      if (key === 'franchiseCity') {
        return { ...prev, franchiseCity: value, franchiseSubDistrict: '' }
      }
      return { ...prev, [key]: value }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const normalizedEmail = normalizeEmail(email)
    setEmail(normalizedEmail)
    try {
      const user = await login(normalizedEmail, password)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true')
        localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ email: normalizedEmail, password }))
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY)
        localStorage.removeItem(REMEMBERED_LOGIN_KEY)
      }
      const firstName = user?.name ? user.name.split(' ')[0] : 'User'
      toast.success(`Welcome back, ${firstName}!`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to login. Please try again.'))
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const normalizedEmail = normalizeEmail(registerForm.email)
    const phone = normalizeIndianPhone(registerForm.phone)
    const alternateContact = normalizeIndianPhone(registerForm.alternateContact)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Contact number must be a valid 10-digit mobile number.')
      return
    }
    if (registerForm.alternateContact && !/^[6-9]\d{9}$/.test(alternateContact)) {
      toast.error('Alternate contact must also be a valid 10-digit number.')
      return
    }
    setRegistering(true)
    try {
      const formData = new FormData()
      formData.append('name', registerForm.name)
      formData.append('email', normalizedEmail)
      formData.append('password', registerForm.password)
      formData.append('phone', phone)
      formData.append('alternateContact', alternateContact)
      formData.append('permanentAddress', registerForm.permanentAddress)
      formData.append('address', registerForm.address)
      formData.append('state', registerForm.state)
      formData.append('city', registerForm.city)
      formData.append('pincode', registerForm.pincode)
      formData.append('franchiseEnabled', String(registerForm.franchiseEnabled))
      formData.append('franchiseName', registerForm.franchiseName)
      formData.append('franchiseState', registerForm.franchiseState)
      formData.append('franchiseCity', registerForm.franchiseCity)
      formData.append('franchiseSubDistrict', registerForm.franchiseSubDistrict)
      if (registerForm.documents) {
        formData.append('documents', registerForm.documents)
      }
      formData.append('dateOfJoining', registerForm.dateOfJoining)
      formData.append('role', registerForm.role)

      await authAPI.register(formData)
      setRegisterForm(emptyRegisterForm)
      setMode('login')
      setEmail(normalizedEmail)
      setPassword('')
      toast.success('Registration submitted. You can log in after admin approval.')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to register. Please try again.'))
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:24, padding:32, maxWidth:mode === 'register' ? 560 : 420, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:60, height:60, background:'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 12px', color:'#111827' }}>
            <FaSolarPanel />
          </div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:600, marginBottom:6 }}>Mahaveer Multi Engineering</h2>
          <p style={{ fontSize:14, color:'var(--muted)' }}>
            {mode === 'login' ? 'Login to access your dashboard' : 'Create your account to continue'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:12 }}>
                <label className="form-label">Email Address</label>
                <input
                  className="crm-input"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
                  required
                />
              </div>

              <div style={{ marginBottom:16 }}>
                <label className="form-label">Password</label>
                <input
                  className="crm-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setRememberMe(checked)
                    if (!checked) {
                      localStorage.removeItem(REMEMBER_ME_KEY)
                      localStorage.removeItem(REMEMBERED_LOGIN_KEY)
                    }
                  }}
                />
                <label htmlFor="remember-me" style={{ fontSize:13, color:'var(--muted)', cursor:'pointer' }}>
                  Remember me
                </label>
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--red)', marginBottom:14 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:15 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--dim)' }}>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                style={{ background:'transparent', border:0, padding:0, color:'var(--sun)', cursor:'pointer', fontWeight:700 }}
              >
                Register
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleRegister}>
              <div className="dashboard-form-grid" style={{ gap:12 }}>
                <div>
                  <label className="form-label">Name</label>
                  <input className="crm-input" value={registerForm.name} onChange={(e) => setRegisterField('name', e.target.value)} required />
                </div>

                <div>
                  <label className="form-label">Contact</label>
                  <input className="crm-input" value={registerForm.phone} onChange={(e) => setRegisterField('phone', normalizeIndianPhone(e.target.value))} maxLength={10} placeholder="10-digit number" required />
                </div>

                <div>
                  <label className="form-label">Alternate Contact</label>
                  <input className="crm-input" value={registerForm.alternateContact} onChange={(e) => setRegisterField('alternateContact', normalizeIndianPhone(e.target.value))} maxLength={10} placeholder="10-digit number" />
                </div>

                <div>
                  <label className="form-label">Email Address</label>
                  <input className="crm-input" type="email" value={registerForm.email} onChange={(e) => setRegisterField('email', e.target.value)} onBlur={(e) => setRegisterField('email', normalizeEmail(e.target.value))} required />
                </div>

                <div>
                  <label className="form-label">Password</label>
                  <input className="crm-input" type="password" value={registerForm.password} onChange={(e) => setRegisterField('password', e.target.value)} required />
                </div>

                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Role</label>
                  <SearchableSelect
                    name="role"
                    value={registerForm.role}
                    onChange={(value) => setRegisterField('role', value)}
                    options={toOptions(REGISTER_ROLES)}
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
                    disabled={!registerForm.state}
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
                        disabled={!registerForm.franchiseState}
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
                        disabled={!registerForm.franchiseCity}
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

              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:15, marginTop:16 }} disabled={registering}>
                {registering ? 'Creating account...' : 'Register'}
              </button>
            </form>

            <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--dim)' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ background:'transparent', border:0, padding:0, color:'var(--sun)', cursor:'pointer', fontWeight:700 }}
              >
                Login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
