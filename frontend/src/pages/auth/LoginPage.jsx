import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FaSolarPanel } from 'react-icons/fa'
import { submitUserAccount } from '../../services/userAccount'
import { useAuthStore } from '../../store'
import UserAccountForm from '../../components/common/UserAccountForm'
import { normalizeAccountEmail } from '../../utils/userAccount'

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

export default function LoginPage() {
  const rememberedLogin = getRememberedLogin()
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState(rememberedLogin?.email || '')
  const [password, setPassword] = useState(rememberedLogin?.password || '')
  const [rememberMe, setRememberMe] = useState(localStorage.getItem(REMEMBER_ME_KEY) === 'true' && !!rememberedLogin)
  const [registering, setRegistering] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const normalizedEmail = normalizeAccountEmail(email)
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

  const handleRegister = async (form) => {
    await submitUserAccount(form, {
      onDocumentError: () => toast.error('Registration saved, but document upload failed. Admin can upload it later.'),
    })
    setMode('login')
    setEmail(normalizeAccountEmail(form.email))
    setPassword('')
    toast.success('Registration submitted. You can log in after admin approval.')
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
                  onBlur={(e) => setEmail(normalizeAccountEmail(e.target.value))}
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
            <UserAccountForm onSubmit={handleRegister} onBusyChange={setRegistering} />

            <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--dim)' }}>
              Already have an account?{' '}
              <button
                type="button"
                disabled={registering}
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
