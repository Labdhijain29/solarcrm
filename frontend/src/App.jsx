import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAppStore, useAuthStore } from './store'

// Website Pages
import HomePage    from './pages/website/HomePage'
import AboutPage   from './pages/website/AboutPage'
import ServicesPage from './pages/website/ServicesPage'
import ContactPage from './pages/website/ContactPage'
import SiteLayout  from './components/layout/SiteLayout'

// Auth
import LoginPage   from './pages/auth/LoginPage'

// Dashboard Pages
import DashboardLayout  from './components/layout/DashboardLayout'
import AdminDashboard   from './pages/dashboard/AdminDashboard'
import ManagerDashboard from './pages/dashboard/ManagerDashboard'
import SalesDashboard   from './pages/dashboard/SalesDashboard'
import ServiceManagerDashboard from './pages/dashboard/ServiceManagerDashboard'
import StageDashboard   from './pages/dashboard/StageDashboard'
import LeadsPage        from './pages/dashboard/LeadsPage'
import LeadDetailPage   from './pages/dashboard/LeadDetailPage'
import UsersPage        from './pages/dashboard/UsersPage'
import EnquiriesPage    from './pages/dashboard/EnquiriesPage'
import AnalyticsPage    from './pages/dashboard/AnalyticsPage'
import ProfilePage      from './pages/dashboard/ProfilePage'

const ADMIN_STAGE_ROLES = [
  'Registration Executive',
  'Bank/Finance Executive',
  'Loan Officer',
  'Dispatch Manager',
  'Installation Manager',
  'Net Metering Officer',
  'Subsidy Officer',
]

function PrivateRoute({ children }) {
  const { user } = useAuthStore()
  return user ? children : <Navigate to="/login" replace />
}

function AdminOnlyRoute({ children }) {
  const { user } = useAuthStore()
  return user?.role === 'Admin' ? children : <Navigate to="/dashboard" replace />
}

function DashboardRouter() {
  const { user } = useAuthStore()
  const role = user?.role?.trim().toLowerCase()
  if (!user) return <Navigate to="/login" replace />
  if (role === 'admin') return <AdminDashboard />
  if (role === 'manager') return <ManagerDashboard />
  if (role === 'sales manager') return <SalesDashboard />
  if (role === 'service manager') return <ServiceManagerDashboard />
  return <StageDashboard />
}

function AdminStageDashboardRoute({ role }) {
  return (
    <AdminOnlyRoute>
      <StageDashboard roleOverride={role} />
    </AdminOnlyRoute>
  )
}

export default function App() {
  const { theme } = useAppStore()

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'custom-toast',
          duration: 3500,
          style: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13 },
        }}
      />

      <Routes>
        {/* ─── Public Website ─── */}
        <Route element={<SiteLayout />}>
          <Route path="/"         element={<HomePage />} />
          <Route path="/about"    element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contact"  element={<ContactPage />} />
        </Route>

        {/* ─── Auth ─── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ─── CRM Dashboard ─── */}
        <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index            element={<DashboardRouter />} />
          <Route path="admin"     element={<AdminOnlyRoute><AdminDashboard /></AdminOnlyRoute>} />
          <Route path="manager"   element={<AdminOnlyRoute><ManagerDashboard /></AdminOnlyRoute>} />
          <Route path="sales"     element={<AdminOnlyRoute><SalesDashboard /></AdminOnlyRoute>} />
          <Route path="service"   element={<AdminOnlyRoute><ServiceManagerDashboard /></AdminOnlyRoute>} />
          {ADMIN_STAGE_ROLES.map(role => (
            <Route
              key={role}
              path={`stage/${role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              element={<AdminStageDashboardRoute role={role} />}
            />
          ))}
          <Route path="leads"     element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="users"     element={<UsersPage />} />
          <Route path="enquiries" element={<EnquiriesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="profile"   element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
