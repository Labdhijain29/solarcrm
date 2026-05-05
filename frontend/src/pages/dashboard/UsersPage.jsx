import { useState, useEffect } from 'react'
import { FaBell, FaChartLine, FaCheck, FaClipboardList, FaEdit, FaExchangeAlt, FaEye, FaFileInvoice, FaMoneyBillWave, FaRegBuilding, FaSolarPanel, FaTimes, FaTrash, FaUser, FaUserShield, FaUsers, FaWrench } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { usersAPI, dashboardAPI, authAPI, getPublicFileUrl } from '../../services/api'
import { EmptyState, FilePreview, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import { getCitiesForState, ROLE_STAGE_MAP, STAGE_COLORS, STATE_OPTIONS } from '../../utils/constants'
import { useAuthStore } from '../../store'
import { getFileDisplayName } from '../../utils/files'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

const ROLE_ICON_MAP = {
  Admin: FaUserShield,
  Manager: FaRegBuilding,
  'Sales Executive': FaUsers,
  'Sales Manager': FaUsers,
  'Registration Executive': FaClipboardList,
  'Bank/Finance Executive': FaRegBuilding,
  'Loan Officer': FaMoneyBillWave,
  'Dispatch Manager': FaExchangeAlt,
  'Installation Manager': FaSolarPanel,
  'Net Metering Officer': FaBell,
  'Subsidy Officer': FaFileInvoice,
  'Subsidy Reading Officer': FaFileInvoice,
  'Service Manager': FaWrench,
}

const formatDate = (value, withTime = false) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return withTime
    ? date.toLocaleString('en-IN')
    : date.toLocaleDateString('en-IN')
}

const getApprovalBadgeClass = (user) => {
  if (user.approvalStatus === 'pending') return 'badge-sun'
  if (user.approvalStatus === 'rejected') return 'badge-red'
  return 'badge-green'
}

const getDocumentName = (filePath) => {
  if (!filePath) return ''
  return getFileDisplayName(filePath, 'document')
}

const detailItems = (items) => items.filter(([, value]) => value !== '-' && value !== '' && value !== null && value !== undefined)
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const normalizeIndianPhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)

function UserDetailsModal({ user, onClose }) {
  const documentFile = user.documentsFile || user.documents
  const documentUrl = documentFile ? getPublicFileUrl(documentFile) : ''
  const documentName = getDocumentName(documentFile)
  const profileItems = [
    ['Name', user.name || '-'],
    ['Email', user.email || '-'],
    ['Phone', user.phone || '-'],
    ['Alternate Contact', user.alternateContact || '-'],
    ['Role', user.role || '-'],
  ]
  const approvalItems = [
    ['Approval Status', user.approvalStatus || (user.isActive ? 'approved' : 'pending')],
    ['Access', user.isActive ? 'Active' : 'Blocked'],
    ['Stage Access', ROLE_STAGE_MAP[user.role] || 'All Stages'],
    ['Joined', formatDate(user.createdAt)],
    ['Approved On', formatDate(user.approvedAt, true)],
  ]
  const addressItems = detailItems([
    ['Permanent Address', user.permanentAddress || '-'],
    ['Current Address', user.address || '-'],
    ['State', user.state || '-'],
    ['City', user.city || '-'],
    ['Pincode', user.pincode || '-'],
  ])
  const franchiseItems = detailItems([
    ['Franchise', user.franchiseEnabled ? 'Enabled' : 'Disabled'],
    ['Franchise Name', user.franchiseName || '-'],
    ['Franchise State', user.franchiseState || '-'],
    ['Franchise City', user.franchiseCity || '-'],
    ['Franchise Sub-District', user.franchiseSubDistrict || '-'],
  ])
  const employmentItems = detailItems([
    ['Date of Joining', formatDate(user.dateOfJoining)],
    ['Job Title', user.jobTitle || '-'],
  ])

  const renderSection = (title, items) => (
    <div className="crm-card-sm">
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>
        {title}
      </div>
      <div className="dashboard-mini-grid-2">
        {items.map(([label, value]) => (
          <div key={label} className="crm-card-sm" style={{ padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-word' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:920 }}>
        <div className="dashboard-split-row" style={{ marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>{user.name}</h2>
            <div className="dashboard-inline-actions" style={{ marginTop:6 }}>
              <span className="badge badge-indigo">{user.role}</span>
              <span className={`badge ${getApprovalBadgeClass(user)}`}>
                {user.approvalStatus || (user.isActive ? 'approved' : 'pending')}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Close user details"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className="dashboard-grid-two" style={{ marginBottom:14 }}>
          {renderSection('Basic Profile', profileItems)}
          {renderSection('Approval & Access', approvalItems)}
        </div>

        {addressItems.length > 0 && (
          <div style={{ marginBottom:14 }}>
            {renderSection('Address Details', addressItems)}
          </div>
        )}

        {franchiseItems.length > 0 && (
          <div style={{ marginBottom:14 }}>
            {renderSection('Franchise Details', franchiseItems)}
          </div>
        )}

        {employmentItems.length > 0 && (
          <div style={{ marginBottom:14 }}>
            {renderSection('Employment Details', employmentItems)}
          </div>
        )}

        {documentUrl && (
          <div className="crm-card-sm">
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>
              Registration Document
            </div>
            <FilePreview file={documentFile} label="Uploaded registration file" fallbackName={documentName} />
          </div>
        )}
      </div>
    </div>
  )
}

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [activeTab, setActiveTab] = useState('unapproved')
  const [search, setSearch] = useState('')
  const [approvedRoleFilter, setApprovedRoleFilter] = useState('all')
  const { user: currentUser } = useAuthStore()

  const fetchUsers = () => {
    setLoading(true)
    usersAPI.getAll()
      .then(r => setUsers(r.data.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleApprove = async (id) => {
    setActioningId(id)
    try {
      await usersAPI.approve(id)
      toast.success('User approved')
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve user')
    } finally {
      setActioningId('')
    }
  }

  const handleReject = async (id) => {
    setActioningId(id)
    try {
      await usersAPI.reject(id)
      toast.success('User rejected')
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject user')
    } finally {
      setActioningId('')
    }
  }

  const handleDelete = async (id) => {
    setActioningId(id)
    try {
      await usersAPI.delete(id)
      toast.success('User deleted')
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    } finally {
      setActioningId('')
    }
  }

  const approvedUsers = users
    .filter((u) => (u.approvalStatus || (u.isActive ? 'approved' : 'pending')) === 'approved')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const unapprovedUsers = users
    .filter((u) => (u.approvalStatus || (u.isActive ? 'approved' : 'pending')) !== 'approved')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const approvedRoleOptions = [...new Set(approvedUsers.map((u) => u.role).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const activeUsers = activeTab === 'approved' ? approvedUsers : unapprovedUsers
  const normalizedSearch = search.trim().toLowerCase()
  const filteredUsers = activeUsers.filter((u) => {
    const matchesSearch = !normalizedSearch
      || u.name?.toLowerCase().includes(normalizedSearch)
      || u.email?.toLowerCase().includes(normalizedSearch)
      || u.phone?.includes(normalizedSearch)

    const matchesRole = activeTab !== 'approved'
      || approvedRoleFilter === 'all'
      || u.role === approvedRoleFilter

    return matchesSearch && matchesRole
  })

  if (loading) return <Spinner />

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaUsers />} title="User Management" subtitle={`${users.length} system users`} />
      <div className="dashboard-table-filters" style={{ marginBottom: 16 }}>
        <div className="dashboard-search">
          <input
            className="crm-input"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {activeTab === 'approved' && (
          <div style={{ minWidth: 220, flex: '0 0 220px' }}>
            <SearchableSelect
              name="approvedRoleFilter"
              value={approvedRoleFilter}
              onChange={(value) => setApprovedRoleFilter(value)}
              options={[{ value: 'all', label: 'All Roles' }, ...toOptions(approvedRoleOptions)]}
              placeholder="All Roles"
              searchPlaceholder="Search role..."
            />
          </div>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredUsers.length} users</span>
      </div>
      <div className="crm-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`crm-tab ${activeTab === 'unapproved' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('unapproved')
            setApprovedRoleFilter('all')
          }}
        >
          Unapproved ({unapprovedUsers.length})
        </button>
        <button
          type="button"
          className={`crm-tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Approved ({approvedUsers.length})
        </button>
      </div>
      <div className="crm-table-wrap">
        {filteredUsers.length === 0 ? (
          <EmptyState
            title={users.length === 0 ? 'No users found' : activeTab === 'approved' ? 'No approved users' : 'No unapproved users'}
            subtitle={activeTab === 'approved' ? 'Approved users will appear here after admin approval.' : 'Pending and rejected registrations will appear here.'}
          />
        ) : (
          <>
            <table className="crm-table">
              <thead>
                <tr>{['User', 'Role', 'Approval', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const isPending = u.approvalStatus === 'pending'
                  const isRejected = u.approvalStatus === 'rejected'
                  const isSelf = currentUser?._id === u._id

                  return (
                    <tr key={u._id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <div style={{ fontSize: 18, marginTop:2 }}>{(() => { const Icon = ROLE_ICON_MAP[u.role] || FaUser; return <Icon /> })()}</div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight: 600, wordBreak:'break-word' }}>{u.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak:'break-word' }}>{u.email}</div>
                            <div style={{ fontSize: 12, color: 'var(--dim)' }}>{u.phone || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-indigo">{u.role}</span></td>
                      <td>
                        <span className={`badge ${getApprovalBadgeClass(u)}`}>
                          {u.approvalStatus || (u.isActive ? 'approved' : 'pending')}
                        </span>
                      </td>
                      <td>
                        <div className="dashboard-inline-actions" style={{ gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => setSelectedUser(u)}
                            disabled={actioningId === u._id}
                            title="View details"
                            aria-label={`View details for ${u.name}`}
                          >
                            <FaEye />
                          </button>
                          {!isSelf && isPending && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm btn-icon"
                              disabled={actioningId === u._id}
                              onClick={() => handleApprove(u._id)}
                              title="Approve user"
                              aria-label={`Approve ${u.name}`}
                            >
                              <FaCheck />
                            </button>
                          )}
                          {!isSelf && (isPending || !isRejected) && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icon"
                              disabled={actioningId === u._id}
                              onClick={() => handleReject(u._id)}
                              title="Reject user"
                              aria-label={`Reject ${u.name}`}
                            >
                              <FaTimes />
                            </button>
                          )}
                          {!isSelf && isRejected && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm btn-icon"
                              disabled={actioningId === u._id}
                              onClick={() => handleApprove(u._id)}
                              title="Re-approve user"
                              aria-label={`Re-approve ${u.name}`}
                            >
                              <FaCheck />
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icon"
                              disabled={actioningId === u._id}
                              onClick={() => handleDelete(u._id)}
                              title="Delete user"
                              aria-label={`Delete ${u.name}`}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="crm-mobile-cards">
              {filteredUsers.map((u) => {
                const isPending = u.approvalStatus === 'pending'
                const isRejected = u.approvalStatus === 'rejected'
                const isSelf = currentUser?._id === u._id

                return (
                  <div key={u._id} className="crm-mobile-card">
                    <div className="dashboard-split-row" style={{ marginBottom: 10 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{u.phone || '-'}</div>
                      </div>
                      <span className="badge badge-indigo">{u.role}</span>
                    </div>

                    {[
                      ['Approval', u.approvalStatus || (u.isActive ? 'approved' : 'pending')],
                    ].map(([label, value]) => (
                      <div key={label} className="crm-mobile-row">
                        <span className="crm-mobile-label">{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}

                    {!isSelf && (
                      <div className="dashboard-inline-actions" style={{ marginTop: 10, gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => setSelectedUser(u)}
                          disabled={actioningId === u._id}
                          title="View details"
                          aria-label={`View details for ${u.name}`}
                        >
                          <FaEye />
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm btn-icon"
                            disabled={actioningId === u._id}
                            onClick={() => handleApprove(u._id)}
                            title="Approve user"
                            aria-label={`Approve ${u.name}`}
                          >
                            <FaCheck />
                          </button>
                        )}
                        {(isPending || !isRejected) && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-icon"
                            disabled={actioningId === u._id}
                            onClick={() => handleReject(u._id)}
                            title="Reject user"
                            aria-label={`Reject ${u.name}`}
                          >
                            <FaTimes />
                          </button>
                        )}
                        {isRejected && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm btn-icon"
                            disabled={actioningId === u._id}
                            onClick={() => handleApprove(u._id)}
                            title="Re-approve user"
                            aria-label={`Re-approve ${u.name}`}
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm btn-icon"
                          disabled={actioningId === u._id}
                          onClick={() => handleDelete(u._id)}
                          title="Delete user"
                          aria-label={`Delete ${u.name}`}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                    {isSelf && (
                      <div className="dashboard-inline-actions" style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => setSelectedUser(u)}
                          title="View details"
                          aria-label={`View details for ${u.name}`}
                        >
                          <FaEye />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {selectedUser && <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  )
}

const TT = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }

export function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  useEffect(() => { dashboardAPI.getStats().then(r => setStats(r.data.data)).catch(console.error) }, [])
  if (!stats) return <Spinner />

  const { summary, stageData, sourceData, monthlyData } = stats

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaChartLine />} title="Analytics" subtitle="Pipeline analytics and conversion metrics" />

      <div className="dashboard-grid-metrics" style={{ gap: 14 }}>
        {[
          { label: 'Total Leads', val: summary.total, color: '#F59E0B' },
          { label: 'Active', val: summary.active, color: '#3B82F6' },
          { label: 'Completed', val: summary.completed, color: '#10B981' },
          { label: 'Rejected', val: summary.rejected, color: '#EF4444' },
          { label: 'Conv. Rate', val: `${summary.conversionRate}%`, color: '#6366F1' },
          { label: 'Enquiries', val: summary.enquiries, color: '#EC4899' },
        ].map(m => (
          <div key={m.label} className="metric-card">
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 700, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid-two" style={{ marginBottom: 16 }}>
        <div className="crm-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Monthly Leads</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="leads" stroke="#F59E0B" fill="rgba(245,158,11,.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crm-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Lead Sources</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {(sourceData || []).map((_, i) => <Cell key={i} fill={['#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#F97316'][i % 6]} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crm-card" style={{ gridColumn: '1/-1' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Leads by Stage</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(stageData || []).map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    alternateContact: '',
    jobTitle: '',
    permanentAddress: '',
    address: '',
    state: '',
    city: '',
      pincode: '',
  })
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [form, setForm] = useState({ newPassword: '', confirm: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const ProfileIcon = ROLE_ICON_MAP[user?.role] || FaUser
  const infoItems = [
    ['Email', user?.email || '-'],
    ['Phone', user?.phone || '-'],
    ['Role', user?.role || '-'],
    ['Stage Access', ROLE_STAGE_MAP[user?.role] || 'All Stages'],
    ['Last Login', user?.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : '-'],
    ['Status', 'Active'],
  ]

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      phone: user?.phone || '',
      alternateContact: user?.alternateContact || '',
      jobTitle: user?.jobTitle || '',
      permanentAddress: user?.permanentAddress || '',
      address: user?.address || '',
      state: user?.state || '',
      city: user?.city || '',
      pincode: user?.pincode || '',
    })
  }, [user])

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => {
      if (key === 'state') return { ...prev, state: value, city: '' }
      return { ...prev, [key]: value }
    })
  }

  const resetProfileForm = () => {
    setProfileForm({
      name: user?.name || '',
      phone: user?.phone || '',
      alternateContact: user?.alternateContact || '',
      jobTitle: user?.jobTitle || '',
      permanentAddress: user?.permanentAddress || '',
      address: user?.address || '',
      state: user?.state || '',
      city: user?.city || '',
      pincode: user?.pincode || '',
    })
  }

  const closeEditProfile = () => {
    resetProfileForm()
    setIsEditingProfile(false)
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { data } = await usersAPI.updateMe({
        ...profileForm,
        name: profileForm.name.trim(),
        phone: normalizeIndianPhone(profileForm.phone),
        alternateContact: normalizeIndianPhone(profileForm.alternateContact),
        jobTitle: profileForm.jobTitle.trim(),
        permanentAddress: profileForm.permanentAddress.trim(),
        address: profileForm.address.trim(),
        state: profileForm.state,
        city: profileForm.city,
        pincode: String(profileForm.pincode || '').replace(/\D/g, '').slice(0, 6),
      })
      setUser(data.data)
      toast.success(data.message || 'Profile updated successfully')
      setIsEditingProfile(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePass = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await authAPI.changePassword({ newPassword: form.newPassword })
      toast.success('Password changed successfully!')
      setForm({ newPassword: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-page profile-page">
      <PageHeader icon={<ProfileIcon />} title="My Profile" subtitle="Your account information and security settings" />

      <div className="profile-layout">
        {isEditingProfile ? (
          <div className="crm-card">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom: 18, flexWrap:'wrap' }}>
              <div>
                <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Update Profile</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Edit your contact and address details here.
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeEditProfile} disabled={savingProfile}>
                Cancel
              </button>
            </div>

            <form onSubmit={saveProfile}>
              <div className="dashboard-form-grid">
                <div>
                  <label className="form-label">Name</label>
                  <input className="crm-input" value={profileForm.name} onChange={(e) => updateProfileField('name', e.target.value)} required />
                </div>

                <div>
                  <label className="form-label">Phone</label>
                  <input className="crm-input" value={profileForm.phone} onChange={(e) => updateProfileField('phone', normalizeIndianPhone(e.target.value))} maxLength={10} placeholder="10-digit number" />
                </div>

                <div>
                  <label className="form-label">Alternate Contact</label>
                  <input className="crm-input" value={profileForm.alternateContact} onChange={(e) => updateProfileField('alternateContact', normalizeIndianPhone(e.target.value))} maxLength={10} placeholder="10-digit number" />
                </div>

                <div>
                  <label className="form-label">Job Title</label>
                  <input className="crm-input" value={profileForm.jobTitle} onChange={(e) => updateProfileField('jobTitle', e.target.value)} placeholder="Enter job title" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Permanent Address</label>
                  <input className="crm-input" value={profileForm.permanentAddress} onChange={(e) => updateProfileField('permanentAddress', e.target.value)} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Current Address</label>
                  <input className="crm-input" value={profileForm.address} onChange={(e) => updateProfileField('address', e.target.value)} />
                </div>

                <div>
                  <label className="form-label">State</label>
                  <SearchableSelect
                    name="profile-state"
                    value={profileForm.state}
                    onChange={(value) => updateProfileField('state', value)}
                    options={toOptions(STATE_OPTIONS)}
                    placeholder="Select state..."
                    searchPlaceholder="Search state..."
                  />
                </div>

                <div>
                  <label className="form-label">City</label>
                  <SearchableSelect
                    name="profile-city"
                    value={profileForm.city}
                    onChange={(value) => updateProfileField('city', value)}
                    options={toOptions(getCitiesForState(profileForm.state))}
                    placeholder={profileForm.state ? 'Select city...' : 'Select state first'}
                    searchPlaceholder="Search city..."
                    noOptionsText={profileForm.state ? 'No cities found' : 'Select state first'}
                    disabled={!profileForm.state}
                  />
                </div>

                <div>
                  <label className="form-label">Pincode</label>
                  <input className="crm-input" value={profileForm.pincode} onChange={(e) => updateProfileField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="6-digit pincode" />
                </div>
              </div>

              <div className="dashboard-inline-actions profile-form-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="crm-card">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom: 20, flexWrap:'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg,rgba(245,158,11,.2),rgba(249,115,22,.1))', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
                  <ProfileIcon />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 700, wordBreak: 'break-word' }}>{user?.name}</h2>
                  <div className="dashboard-inline-actions" style={{ marginTop: 8 }}>
                    <span className="badge badge-indigo">{user?.role}</span>
                    <span className="badge badge-green">Account Active</span>
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setIsEditingProfile(true)} title="Edit profile" aria-label="Edit profile">
                <FaEdit />
              </button>
            </div>

            <div className="profile-info-list">
              {infoItems.map(([label, value]) => (
                <div key={label} className="profile-info-row">
                  <span className="profile-info-label">{label}</span>
                  <span className="profile-info-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-stack" style={{ gap: 16 }}>
          <div className="crm-card">
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Change Password</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Update your password to keep this account secure.
              </p>
            </div>
            <form onSubmit={changePass}>
              {[['New Password', 'newPassword'], ['Confirm New Password', 'confirm']].map(([label, key]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label className="form-label">{label}</label>
                  <input className="crm-input" type="password" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required />
                </div>
              ))}
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsersPage
