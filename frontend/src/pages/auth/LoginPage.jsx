import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FaSolarPanel } from 'react-icons/fa'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { getCitiesForState, getSubDistrictOptions, STATE_OPTIONS } from '../../utils/constants'

const REGISTER_ROLES = [
  'Manager',
  'Sales Manager',
  'Registration Executive',
  'Bank/Finance Executive',
  'Loan Officer',
  'Dispatch Manager',
  'Installation Manager',
  'Net Metering Officer',
  'Subsidy Officer',
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
  documents: '',
  dateOfJoining: '',
  role: 'Sales Manager',
}

const normalizeIndianPhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    try {
      const user = await login(email, password)
      const firstName = user?.name ? user.name.split(' ')[0] : 'User'
      toast.success(`Welcome back, ${firstName}!`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const phone = normalizeIndianPhone(registerForm.phone)
    const alternateContact = normalizeIndianPhone(registerForm.alternateContact)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Contact number 10 digits ka valid mobile number hona chahiye.')
      return
    }
    if (registerForm.alternateContact && !/^[6-9]\d{9}$/.test(alternateContact)) {
      toast.error('Alternate contact bhi valid 10-digit number hona chahiye.')
      return
    }
    setRegistering(true)
    try {
      await authAPI.register({
        ...registerForm,
        phone,
        alternateContact,
      })
      setRegisterForm(emptyRegisterForm)
      setMode('login')
      setEmail(registerForm.email)
      setPassword('')
      toast.success('Registration submitted. Admin approval ke baad login hoga.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
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
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, marginBottom:6 }}>SolarPro CRM</h2>
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
                  <input className="crm-input" type="email" value={registerForm.email} onChange={(e) => setRegisterField('email', e.target.value)} required />
                </div>

                <div>
                  <label className="form-label">Password</label>
                  <input className="crm-input" type="password" value={registerForm.password} onChange={(e) => setRegisterField('password', e.target.value)} required />
                </div>

                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Role</label>
                  <select className="crm-input" value={registerForm.role} onChange={(e) => setRegisterField('role', e.target.value)} required>
                    {REGISTER_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
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
                  <select className="crm-input" value={registerForm.state} onChange={(e) => setRegisterField('state', e.target.value)}>
                    <option value="">Select state...</option>
                    {STATE_OPTIONS.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">City</label>
                  <select className="crm-input" value={registerForm.city} onChange={(e) => setRegisterField('city', e.target.value)} disabled={!registerForm.state}>
                    <option value="">{registerForm.state ? 'Select city...' : 'Select state first'}</option>
                    {getCitiesForState(registerForm.state).map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
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
                      <select className="crm-input" value={registerForm.franchiseState} onChange={(e) => setRegisterField('franchiseState', e.target.value)}>
                        <option value="">Select state...</option>
                        {STATE_OPTIONS.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Franchise City</label>
                      <select className="crm-input" value={registerForm.franchiseCity} onChange={(e) => setRegisterField('franchiseCity', e.target.value)} disabled={!registerForm.franchiseState}>
                        <option value="">{registerForm.franchiseState ? 'Select city...' : 'Select state first'}</option>
                        {getCitiesForState(registerForm.franchiseState).map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Franchise Sub-District</label>
                      <select className="crm-input" value={registerForm.franchiseSubDistrict} onChange={(e) => setRegisterField('franchiseSubDistrict', e.target.value)} disabled={!registerForm.franchiseCity}>
                        <option value="">{registerForm.franchiseCity ? 'Select sub-district...' : 'Select city first'}</option>
                        {getSubDistrictOptions(registerForm.franchiseCity).map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Documents</label>
                  <input
                    className="crm-input"
                    type="file"
                    onChange={(e) => setRegisterField('documents', e.target.files?.[0]?.name || '')}
                  />
                  {registerForm.documents && (
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>
                      Selected: {registerForm.documents}
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
