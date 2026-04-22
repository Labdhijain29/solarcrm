import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import EnquiryForm from '../website/EnquiryForm'

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
]

export default function SiteLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAppStore()
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav className="site-nav">
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>SP</div>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'var(--text)' }}>Mahaveer Multi Engeering</span>
        </Link>

        <button className="btn btn-ghost btn-sm site-nav-toggle" onClick={() => setMenuOpen(prev => !prev)}>
          {menuOpen ? 'Close Menu' : 'Menu'}
        </button>

        <ul className={`site-nav-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                style={{
                  color: pathname === link.to ? 'var(--text)' : 'var(--muted)',
                  fontSize:14,
                  fontWeight:500,
                  textDecoration:'none',
                  transition:'color .2s'
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="site-nav-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setEnquiryOpen(true)}>
            Enquiry Form
          </button>
          <button className="btn-icon btn-ghost btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? 'LT' : 'DK'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            CRM Login
          </button>
        </div>
      </nav>

      <main>
        <Outlet />
      </main>

      {enquiryOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEnquiryOpen(false)
          }}
          style={{ overflowY:'auto' }}
        >
          <div style={{ width:'100%', maxWidth:680, position:'relative' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setEnquiryOpen(false)}
              style={{ position:'absolute', top:12, right:12, zIndex:2 }}
            >
              Close
            </button>
            <EnquiryForm />
          </div>
        </div>
      )}
    </div>
  )
}
