import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { useAuthStore, useAppStore } from '../../store'
import { ROLE_STAGE_MAP, ROLE_ICONS, stageColor } from '../../utils/constants'

const ADMIN_DASHBOARD_ITEMS = [
  { to: '/dashboard/admin', icon: 'AD', label: 'Admin Dashboard' },
  { to: '/dashboard/manager', icon: 'MN', label: 'Manager Dashboard' },
  { to: '/dashboard/sales', icon: 'SL', label: 'Sales Dashboard' },
  { to: '/dashboard/service', icon: 'SV', label: 'Service Dashboard' },
  { to: '/dashboard/stage/registration-executive', icon: 'RG', label: 'Registration Dashboard' },
  { to: '/dashboard/stage/bank-finance-executive', icon: 'BK', label: 'Bank Dashboard' },
  { to: '/dashboard/stage/loan-officer', icon: 'LN', label: 'Loan Dashboard' },
  { to: '/dashboard/stage/dispatch-manager', icon: 'DP', label: 'Dispatch Dashboard' },
  { to: '/dashboard/stage/installation-manager', icon: 'IN', label: 'Installation Dashboard' },
  { to: '/dashboard/stage/net-metering-officer', icon: 'NM', label: 'Net Metering Dashboard' },
  { to: '/dashboard/stage/subsidy-officer', icon: 'SB', label: 'Subsidy Dashboard' },
]

const COMMON_NAV_ITEMS = [
  { to: '/dashboard/leads', icon: 'LD', label: 'All Leads', roles: ['Admin', 'Manager', 'Sales Manager'] },
  { to: '/dashboard/enquiries', icon: 'EN', label: 'Enquiries', roles: ['Admin', 'Manager', 'Sales Manager', 'Service Manager'] },
  { to: '/dashboard/users', icon: 'US', label: 'Users', roles: ['Admin'] },
  { to: '/dashboard/profile', icon: 'PR', label: 'Profile', roles: null },
]

function SidebarLogo() {
  return (
    <div style={{ padding:'20px 16px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, background:'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>SP</div>
        <div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'var(--text)' }}>SolarPro</div>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:.5, textTransform:'uppercase' }}>CRM System</div>
        </div>
      </div>
    </div>
  )
}

function UserBadge({ user }) {
  return (
    <div style={{ padding:'12px 8px' }}>
      <div style={{ background:'linear-gradient(135deg,rgba(245,158,11,.1),rgba(249,115,22,.05))', border:'1px solid rgba(245,158,11,.15)', borderRadius:10, padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>{ROLE_ICONS[user.role] || 'U'}</span>
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
  const { theme, toggleTheme, sidebarOpen, toggleSidebar, closeSidebar } = useAppStore()
  const navigate = useNavigate()
  const stageAccess = ROLE_STAGE_MAP[user?.role]
  const visibleNav = COMMON_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role))
  const showAdminDashboards = user?.role === 'Admin'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
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
                <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        <div style={{ padding:'8px 0' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.8, padding:'10px 16px 6px' }}>Navigation</div>
          {visibleNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
              <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {stageAccess && (
          <div style={{ padding:'8px 0' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.8, padding:'10px 16px 6px' }}>My Stage</div>
            <div className="nav-item active">
              <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>ST</span>
              <span>{stageAccess}</span>
              <div style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:stageColor(stageAccess) }} />
            </div>
          </div>
        )}

        <div style={{ marginTop:'auto', padding:'8px 0', borderTop:'1px solid var(--border)' }}>
          <div className="nav-item" onClick={toggleTheme}>
            <span style={{ fontSize:13, width:24, textAlign:'center', fontWeight:700 }}>{theme === 'dark' ? 'LT' : 'DK'}</span>
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

      <div className="app-main">
        <header className="app-topbar">
          <button onClick={toggleSidebar} className="btn btn-ghost btn-icon" style={{ display:'flex' }}>|||</button>

          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14, flex:1 }}>SolarPro CRM</span>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme}>
              {theme === 'dark' ? 'LT' : 'DK'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleLogout}>
              <span>{ROLE_ICONS[user?.role]}</span>
              <span>{user?.name?.split(' ')[0]}</span>
              <span style={{ fontSize:10, color:'var(--dim)' }}>| {user?.role?.split(' ')[0]}</span>
            </button>
          </div>
        </header>

        <div style={{ padding:24 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
