import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { FaMoon, FaSun } from 'react-icons/fa'
import { useAppStore } from '../../store'
import SiteFooter from './SiteFooter'
import mahaveerSolarLogo from '../../assets/mahaveer-solar-logo.svg'

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/products', label: 'Products' },
  { to: '/contact', label: 'Contact' },
]

export default function SiteLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const ThemeIcon = theme === 'dark' ? FaSun : FaMoon

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav className="site-nav">
        <Link to="/" className="site-brand">
          <img className="site-brand-logo" src={mahaveerSolarLogo} alt="Mahavir Solar" />
        </Link>

        <button className="btn btn-ghost btn-sm site-nav-toggle" onClick={() => setMenuOpen(prev => !prev)}>
          {menuOpen ? 'Close Menu' : 'Menu'}
        </button>

        <ul className={`site-nav-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`site-nav-link ${pathname === link.to ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="site-nav-actions">
          <button className="btn-icon btn-ghost btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <ThemeIcon />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Login
          </button>
        </div>
      </nav>

      <main>
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}
