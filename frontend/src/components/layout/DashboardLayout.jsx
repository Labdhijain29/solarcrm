import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { FaBan, FaBell, FaBoxOpen, FaBriefcase, FaClipboardList, FaCog, FaExchangeAlt, FaFileInvoice, FaHome, FaMoneyBillWave, FaMoon, FaRegBuilding, FaShippingFast, FaSolarPanel, FaSun, FaTachometerAlt, FaUser, FaUsers, FaUserTie, FaWarehouse, FaWrench } from 'react-icons/fa'
import { useAuthStore, useAppStore } from '../../store'
import { ROLE_STAGE_MAP, stageColor } from '../../utils/constants'
import { usersAPI } from '../../services/api'
import SiteFooter from './SiteFooter'
import mahaveerSolarLogo from '../../assets/mahaveer-solar-logo.svg'

const ADMIN_DASHBOARD_ITEMS = [
  { to: '/dashboard/admin', icon: FaTachometerAlt, label: 'Admin Dashboard' },
  { to: '/dashboard/manager', icon: FaRegBuilding, label: 'Manager Dashboard' },
  { to: '/dashboard/sales', icon: FaUsers, label: 'Sales Dashboard' },
  { to: '/dashboard/stage/registration-executive', icon: FaClipboardList, label: 'Registration Dashboard' },
  { to: '/dashboard/stage/bank-finance-executive', icon: FaBriefcase, label: 'Bank Dashboard' },
  { to: '/dashboard/stage/loan-officer', icon: FaMoneyBillWave, label: 'Loan Dashboard' },
  { to: '/dashboard/dispatch-erp', icon: FaShippingFast, label: 'Dispatch Dashboard' },
  { to: '/dashboard/stage/installation-manager', icon: FaSolarPanel, label: 'Installation Dashboard' },
  { to: '/dashboard/stage/net-metering-officer', icon: FaBell, label: 'Net Metering Dashboard' },
  { to: '/dashboard/stage/subsidy-officer', icon: FaFileInvoice, label: 'Subsidy Dashboard' },
  { to: '/dashboard/stage/subsidy-reading-officer', icon: FaFileInvoice, label: 'Subsidy Reading Dashboard' },
]

const COMMON_NAV_ITEMS = [
  { to: '/dashboard/stock-manager', icon: FaWarehouse, label: 'Stock Manager Dashboard' },
  { to: '/dashboard/service', icon: FaWrench, label: 'Service Dashboard' },
  { to: '/dashboard/leads', icon: FaClipboardList, label: 'All Leads', roles: ['Admin', 'Manager', 'Sales Executive', 'Sales Manager'] },
  { to: '/dashboard/rejected-leads', icon: FaBan, label: 'Rejected Leads', roles: ['Admin', 'Manager', 'Sales Executive', 'Sales Manager'] },
  { to: '/dashboard/enquiries', icon: FaBell, label: 'Enquiries', roles: ['Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Service Manager'] },
  { to: '/dashboard/inventory', icon: FaBoxOpen, label: 'Inventory', roles: ['Admin', 'Stock Manager', 'Dispatch Manager'] },
  { to: '/dashboard/users', icon: FaUsers, label: 'Users', roles: ['Admin'] },
  { to: '/dashboard/profile', icon: FaUser, label: 'Profile', roles: null },
]

const ROLE_ICON_MAP = {
  Admin: FaUserTie,
  Manager: FaRegBuilding,
  'Sales Executive': FaUsers,
  'Sales Manager': FaUsers,
  'Registration Executive': FaClipboardList,
  'Bank/Finance Executive': FaBriefcase,
  'Loan Officer': FaMoneyBillWave,
  'Stock Manager': FaWarehouse,
  'Dispatch Manager': FaExchangeAlt,
  'Installation Manager': FaSolarPanel,
  'Net Metering Officer': FaBell,
  'Subsidy Officer': FaFileInvoice,
  'Subsidy Reading Officer': FaFileInvoice,
  'Service Manager': FaWrench,
}

function SidebarLogo() {
  return (
    <div className="dashboard-brand">
      <img className="dashboard-brand-logo" src={mahaveerSolarLogo} alt="Mahavir Solar" />
    </div>
  )
}

function UserBadge({ user }) {
  const Icon = ROLE_ICON_MAP[user.role] || FaUser
  return (
    <div style={{ padding:'12px 8px' }}>
      <div style={{ background:'linear-gradient(135deg,rgba(245,158,11,.1),rgba(249,115,22,.05))', border:'1px solid rgba(245,158,11,.15)', borderRadius:10, padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18, display:'flex' }}><Icon /></span>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{user.name.split(' ')[0]}</div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{user.role}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme, sidebarOpen, toggleSidebar, closeSidebar, notifications, unreadCount, setNotifications } = useAppStore()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const notificationsRef = useRef(null)
  const userMenuRef = useRef(null)
  const stageAccess = ROLE_STAGE_MAP[user?.role]
  const visibleNav = COMMON_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role))
  const showAdminDashboards = user?.role === 'Admin'
  const ThemeIcon = theme === 'dark' ? FaSun : FaMoon

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const loadNotifications = () => {
    usersAPI.getNotifications()
      .then((res) => setNotifications(res.data.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    if (!user) return undefined
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => clearInterval(timer)
  }, [user?._id])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false)
      }

      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowNotifications(false)
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const toggleNotifications = async () => {
    setShowNotifications((prev) => !prev)
    setShowUserMenu(false)
    if (unreadCount > 0) {
      try {
        await usersAPI.markNotificationsRead()
        loadNotifications()
      } catch {}
    }
  }

  const toggleUserMenu = () => {
    setShowUserMenu((prev) => !prev)
    setShowNotifications(false)
  }

  const handleProfileClick = () => {
    setShowUserMenu(false)
    navigate('/dashboard/profile')
  }

  return (
    <div className="app-shell" style={{ display:'flex', minHeight:'100vh' }}>
      {sidebarOpen && (
        <div onClick={closeSidebar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:99 }} />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SidebarLogo />
        <UserBadge user={user} />

        {showAdminDashboards && (
          <div style={{ padding:'8px 0' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.8, padding:'10px 16px 6px' }}>All Dashboards</div>
            {ADMIN_DASHBOARD_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
                <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700, display:'flex', justifyContent:'center' }}><item.icon /></span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        <div style={{ padding:'8px 0' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.8, padding:'10px 16px 6px' }}>Navigation</div>
          {visibleNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
              <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700, display:'flex', justifyContent:'center' }}><item.icon /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {stageAccess && (
          <div style={{ padding:'8px 0' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.8, padding:'10px 16px 6px' }}>My Stage</div>
            <div className="nav-item active">
              <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700, display:'flex', justifyContent:'center' }}><FaCog /></span>
              <span>{stageAccess}</span>
              <div style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:stageColor(stageAccess) }} />
            </div>
          </div>
        )}

        <div style={{ marginTop:'auto', padding:'8px 0', borderTop:'1px solid var(--border)' }}>
          <div className="nav-item" onClick={toggleTheme}>
            <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700, display:'flex', justifyContent:'center' }}><ThemeIcon /></span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <a href="/" className="nav-item">
            <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>WB</span>
            <span>Main Website</span>
          </a>
          <div className="nav-item" style={{ color:'var(--red)' }} onClick={handleLogout}>
            <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>LO</span>
            <span>Logout</span>
          </div>
        </div>
      </aside>

      <div className="app-main dashboard-main-with-footer">
        <header className="app-topbar">
          <button onClick={toggleSidebar} className="btn btn-ghost btn-icon" style={{ display:'flex' }}>|||</button>

          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:400, fontSize:14, flex:1 }}>Mahaveer Multi Engineering</span>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div ref={notificationsRef} style={{ position:'relative' }}>
              <button className="btn btn-ghost btn-icon" onClick={toggleNotifications} title="Notifications" style={{ position:'relative' }}>
                <FaBell />
                {unreadCount > 0 && (
                  <span style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, borderRadius:999, background:'var(--red)', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div style={{ position:'absolute', right:0, top:44, width:320, maxWidth:'calc(100vw - 32px)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 20px 45px rgba(0,0,0,.25)', zIndex:120, overflow:'hidden' }}>
                  <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700 }}>Notifications</div>
                  <div style={{ maxHeight:320, overflowY:'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding:16, fontSize:12, color:'var(--muted)' }}>No notifications yet.</div>
                    ) : notifications.map((item) => (
                      <div key={item._id || item.createdAt} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', background:item.read ? 'transparent' : 'rgba(245,158,11,.08)' }}>
                        <div style={{ fontSize:12, fontWeight:item.read ? 500 : 700 }}>{item.message}</div>
                        <div style={{ fontSize:10, color:'var(--dim)', marginTop:4 }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <ThemeIcon />
            </button>
            <div ref={userMenuRef} style={{ position:'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ display:'flex', alignItems:'center', gap:6 }}
                onClick={toggleUserMenu}
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                <span style={{ display:'flex' }}>{(() => { const TopIcon = ROLE_ICON_MAP[user?.role] || FaUser; return <TopIcon /> })()}</span>
                <span>{user?.name?.split(' ')[0]}</span>
                <span style={{ fontSize:10, color:'var(--dim)' }}>| {user?.role?.split(' ')[0]}</span>
              </button>

              {showUserMenu && (
                <div style={{ position:'absolute', right:0, top:44, width:220, maxWidth:'calc(100vw - 32px)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 20px 45px rgba(0,0,0,.25)', zIndex:120, overflow:'hidden' }}>
                  <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', wordBreak:'break-word' }}>{user?.name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{user?.role}</div>
                  </div>
                  <button
                    type="button"
                    className="dashboard-user-menu-item"
                    onClick={handleProfileClick}
                  >
                    <FaUser />
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-user-menu-item danger"
                    onClick={handleLogout}
                  >
                    <span style={{ width:14, textAlign:'center' }}>LO</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-content-with-footer" style={{ padding:24 }}>
          <Outlet />
        </div>

        <SiteFooter />
      </div>
    </div>
  )
}
