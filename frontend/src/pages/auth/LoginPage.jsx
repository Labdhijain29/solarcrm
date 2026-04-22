import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  FaBuilding, FaChartLine, FaClipboardList, FaCrown, FaGift,
  FaHardHat, FaLandmark, FaMoneyBillWave, FaSolarPanel, FaTools, FaTruck
} from 'react-icons/fa'
import { MdElectricBolt } from 'react-icons/md'

const DEMO_USERS = [
  { role:'Admin',                email:'admin@solarcrm.in',    pass:'admin123',    icon:<FaCrown /> },
  { role:'Manager',              email:'manager@solarcrm.in',  pass:'manager123',  icon:<FaBuilding /> },
  { role:'Sales Manager',        email:'sales@solarcrm.in',    pass:'sales123',    icon:<FaChartLine /> },
  { role:'Registration Exec.',   email:'reg@solarcrm.in',      pass:'reg123',      icon:<FaClipboardList /> },
  { role:'Bank Executive',       email:'bank@solarcrm.in',     pass:'bank123',     icon:<FaLandmark /> },
  { role:'Loan Officer',         email:'loan@solarcrm.in',     pass:'loan123',     icon:<FaMoneyBillWave /> },
  { role:'Dispatch Manager',     email:'dispatch@solarcrm.in', pass:'dispatch123', icon:<FaTruck /> },
  { role:'Installation Manager', email:'install@solarcrm.in',  pass:'install123',  icon:<FaHardHat /> },
  { role:'Net Metering Officer', email:'netmeter@solarcrm.in', pass:'netmeter123', icon:<MdElectricBolt /> },
  { role:'Subsidy Officer',      email:'subsidy@solarcrm.in',  pass:'subsidy123',  icon:<FaGift /> },
  { role:'Service Manager',      email:'service@solarcrm.in',  pass:'service123',  icon:<FaTools /> },
]

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
  jobTitle: '',
  resume: '',
  documents: '',
  dateOfJoining: '',
  role: 'Sales Manager',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selected, setSelected] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)

  const selectUser = (u) => {
    setSelected(u.email)
    setEmail(u.email)
    setPassword(u.pass)
  }

  const setRegisterField = (key, value) => {
    setRegisterForm(prev => ({ ...prev, [key]: value }))
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
    setRegistering(true)
    try {
      await authAPI.register(registerForm)
      setSelected(null)
      setRegisterForm(emptyRegisterForm)
      setMode('login')
      setEmail(registerForm.email)
      setPassword('')
      toast.success('Registration submitted. Admin approval ke baad hi login hoga.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 100% 80% at 50% -20%,rgba(245,158,11,.06),transparent)', pointerEvents:'none' }} />

      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:24, padding:40, maxWidth:mode === 'register' ? 840 : 460, width:'100%', position:'relative' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:60, height:60, background:'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 12px', color:'#111827' }}><FaSolarPanel /></div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, marginBottom:4 }}>SolarPro CRM</h2>
          <p style={{ fontSize:14, color:'var(--muted)' }}>
            {mode === 'login' ? 'Sign in to access your dashboard' : 'Create your account. Admin approval ke baad hi login hoga'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Quick Login - Select Your Role</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7 }}>
                {DEMO_USERS.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => selectUser(u)}
                    style={{
                      background:selected === u.email ? 'rgba(245,158,11,.1)' : 'var(--bg3)',
                      border:`1px solid ${selected === u.email ? 'rgba(245,158,11,.4)' : 'var(--border)'}`,
                      borderRadius:10,
                      padding:'9px 12px',
                      cursor:'pointer',
                      textAlign:'center',
                      transition:'all .2s',
                      fontFamily:'Inter,sans-serif',
                    }}
                  >
                    <div style={{ fontSize:19, marginBottom:3, color:'var(--sun)', display:'flex', justifyContent:'center' }}>{u.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', lineHeight:1.2 }}>{u.role}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:12 }}>
                <label className="form-label">Email Address</label>
                <input className="crm-input" type="email" placeholder="Enter email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ marginBottom:16 }}>
                <label className="form-label">Password</label>
                <input className="crm-input" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--red)', marginBottom:14 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:15 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--dim)' }}>
              No account?{' '}
              <button type="button" onClick={() => setMode('register')} style={{ background:'transparent', border:0, padding:0, color:'var(--sun)', cursor:'pointer', fontWeight:700 }}>
                Register first
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleRegister}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }}>
                <div>
                  <label className="form-label">Name</label>
                  <input className="crm-input" value={registerForm.name} onChange={e => setRegisterField('name', e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input className="crm-input" type="email" value={registerForm.email} onChange={e => setRegisterField('email', e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input className="crm-input" type="password" value={registerForm.password} onChange={e => setRegisterField('password', e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Contact</label>
                  <input className="crm-input" value={registerForm.phone} onChange={e => setRegisterField('phone', e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Alternate Contact</label>
                  <input className="crm-input" value={registerForm.alternateContact} onChange={e => setRegisterField('alternateContact', e.target.value)} />
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Role</label>
                  <select className="crm-input" value={registerForm.role} onChange={e => setRegisterField('role', e.target.value)} required>
                    {REGISTER_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Permanent Address</label>
                  <input className="crm-input" value={registerForm.permanentAddress} onChange={e => setRegisterField('permanentAddress', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input className="crm-input" value={registerForm.address} onChange={e => setRegisterField('address', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">State</label>
                  <input className="crm-input" value={registerForm.state} onChange={e => setRegisterField('state', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input className="crm-input" value={registerForm.city} onChange={e => setRegisterField('city', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Pincode</label>
                  <input className="crm-input" value={registerForm.pincode} onChange={e => setRegisterField('pincode', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Job Title</label>
                  <input className="crm-input" placeholder="Sales / Employee / Sales Manager" value={registerForm.jobTitle} onChange={e => setRegisterField('jobTitle', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Resume</label>
                  <input className="crm-input" value={registerForm.resume} onChange={e => setRegisterField('resume', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Documents</label>
                  <input className="crm-input" value={registerForm.documents} onChange={e => setRegisterField('documents', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Date of Joining</label>
                  <input className="crm-input" type="date" value={registerForm.dateOfJoining} onChange={e => setRegisterField('dateOfJoining', e.target.value)} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:15, marginTop:16 }} disabled={registering}>
                {registering ? 'Creating account...' : 'Register'}
              </button>
            </form>

            <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--dim)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} style={{ background:'transparent', border:0, padding:0, color:'var(--sun)', cursor:'pointer', fontWeight:700 }}>
                Login
              </button>
            </p>
          </>
        )}

        <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'var(--dim)' }}>
          <a href="/" style={{ color:'var(--sun)', textDecoration:'none' }}>Back to website</a>
        </p>
      </div>
    </div>
  )
}
