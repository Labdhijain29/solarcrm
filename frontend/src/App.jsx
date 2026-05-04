import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Spinner } from './components/common'
import { useAppStore, useAuthStore } from './store'

import HomePage from './pages/website/HomePage'
import AboutPage from './pages/website/AboutPage'
import ServicesPage from './pages/website/ServicesPage'
import ContactPage from './pages/website/ContactPage'
import SiteLayout from './components/layout/SiteLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardLayout from './components/layout/DashboardLayout'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import ManagerDashboard from './pages/dashboard/ManagerDashboard'
import SalesDashboard from './pages/dashboard/SalesDashboard'
import SalesExecutiveDashboard from './pages/dashboard/SalesExecutiveDashboard'
import SalesManagerDashboard from './pages/dashboard/SalesManagerDashboard'
import ServiceManagerDashboard from './pages/dashboard/ServiceManagerDashboard'
import StageDashboard from './pages/dashboard/StageDashboard'
import StockManagerDashboard from './pages/dashboard/StockManagerDashboard'
import DispatchManagerDashboard from './pages/dashboard/DispatchManagerDashboard'
import RegistrationDashboard from './pages/dashboard/RegistrationDashboard'
import BankFinanceDashboard from './pages/dashboard/BankFinanceDashboard'
import LoanOfficerDashboard from './pages/dashboard/LoanOfficerDashboard'
import NetMeteringDashboard from './pages/dashboard/NetMeteringDashboard'
import SubsidyDashboard from './pages/dashboard/SubsidyDashboard'
import SubsidyReadingDashboard from './pages/dashboard/SubsidyReadingDashboard'
import LeadsPage from './pages/dashboard/LeadsPage'
import LeadDetailPage from './pages/dashboard/LeadDetailPage'
import RejectedLeadsPage from './pages/dashboard/RejectedLeadsPage'
import UsersPage from './pages/dashboard/UsersPage'
import EnquiriesPage from './pages/dashboard/EnquiriesPage'
import AnalyticsPage from './pages/dashboard/AnalyticsPage'
import ProfilePage from './pages/dashboard/ProfilePage'
import InventoryDispatchPage from './pages/dashboard/InventoryDispatchPage'
import TechUploadSettingsPage from './pages/dashboard/TechUploadSettingsPage'

const ADMIN_STAGE_DASHBOARD_ROUTES = [
  { path: 'stage/registration-executive', element: <RegistrationDashboard /> },
  { path: 'stage/bank-finance-executive', element: <BankFinanceDashboard /> },
  { path: 'stage/loan-officer', element: <LoanOfficerDashboard /> },
  { path: 'stage/dispatch-manager', element: <DispatchManagerDashboard defaultTab="dispatch" /> },
  { path: 'stage/installation-manager', element: <StageDashboard roleOverride="Installation Manager" /> },
  { path: 'stage/net-metering-officer', element: <NetMeteringDashboard /> },
  { path: 'stage/subsidy-officer', element: <SubsidyDashboard /> },
  { path: 'stage/subsidy-reading-officer', element: <SubsidyReadingDashboard /> },
]

function AuthBootstrapScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <div
        className="crm-card"
        style={{
          width: 'min(360px, 100%)',
          textAlign: 'center',
          display: 'grid',
          gap: 8,
          justifyItems: 'center',
        }}
      >
        <Spinner size={30} />
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700 }}>Checking session</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Verifying your login before loading the app.</div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, initialized, checkingAuth } = useAuthStore()

  if (!initialized || checkingAuth) return <AuthBootstrapScreen />
  return user ? children : <Navigate to="/login" replace />
}

function PublicAuthRoute({ children }) {
  const { user, initialized, checkingAuth } = useAuthStore()

  if (!initialized || checkingAuth) return <AuthBootstrapScreen />
  return user ? <Navigate to="/dashboard" replace /> : children
}

function AdminOnlyRoute({ children }) {
  const { user, initialized, checkingAuth } = useAuthStore()

  if (!initialized || checkingAuth) return <AuthBootstrapScreen />
  return user?.role === 'Admin' ? children : <Navigate to="/dashboard" replace />
}

function DashboardRouter() {
  const { user, initialized, checkingAuth } = useAuthStore()
  const role = user?.role?.trim().toLowerCase()

  if (!initialized || checkingAuth) return <AuthBootstrapScreen />
  if (!user) return <Navigate to="/login" replace />
  if (role === 'admin') return <AdminDashboard />
  if (role === 'manager') return <ManagerDashboard />
  if (role === 'sales executive') return <SalesExecutiveDashboard />
  if (role === 'sales manager') return <SalesManagerDashboard />
  if (role === 'stock manager') return <StockManagerDashboard />
  if (role === 'dispatch manager') return <DispatchManagerDashboard />
  if (role === 'installation manager') return <StageDashboard />
  if (role === 'service manager') return <ServiceManagerDashboard />
  return <StageDashboard />
}

export default function App() {
  const theme = useAppStore((state) => state.theme)
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth)

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  useEffect(() => {
    hydrateAuth()
  }, [hydrateAuth])

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
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        <Route
          path="/login"
          element={(
            <PublicAuthRoute>
              <LoginPage />
            </PublicAuthRoute>
          )}
        />

        <Route
          path="/tech/settings"
          element={(
            <PrivateRoute>
              <AdminOnlyRoute>
                <TechUploadSettingsPage />
              </AdminOnlyRoute>
            </PrivateRoute>
          )}
        />

        <Route
          path="/dashboard"
          element={(
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          )}
        >
          <Route index element={<DashboardRouter />} />
          <Route path="admin" element={<AdminOnlyRoute><AdminDashboard /></AdminOnlyRoute>} />
          <Route path="manager" element={<AdminOnlyRoute><ManagerDashboard /></AdminOnlyRoute>} />
          <Route path="sales" element={<AdminOnlyRoute><SalesDashboard /></AdminOnlyRoute>} />
          <Route path="service" element={<AdminOnlyRoute><ServiceManagerDashboard /></AdminOnlyRoute>} />
          <Route path="stock-manager" element={<AdminOnlyRoute><StockManagerDashboard /></AdminOnlyRoute>} />
          <Route path="inventory" element={<InventoryDispatchPage defaultTab="dashboard" />} />
          <Route path="dispatch-erp" element={<DispatchManagerDashboard defaultTab="dispatch" />} />
          {ADMIN_STAGE_DASHBOARD_ROUTES.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<AdminOnlyRoute>{element}</AdminOnlyRoute>}
            />
          ))}
          <Route path="leads" element={<LeadsPage />} />
          <Route path="rejected-leads" element={<RejectedLeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="enquiries" element={<EnquiriesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
