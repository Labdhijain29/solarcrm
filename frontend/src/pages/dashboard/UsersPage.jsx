import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { usersAPI, dashboardAPI, authAPI } from '../../services/api'
import { PageHeader, Spinner } from '../../components/common'
import { ROLE_ICONS, ROLE_STAGE_MAP, STAGE_COLORS } from '../../utils/constants'
import { useAuthStore } from '../../store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState('')
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

  if (loading) return <Spinner />

  return (
    <div className="dashboard-page">
      <PageHeader icon="👥" title="User Management" subtitle={`${users.length} system users`} />
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>{['', 'Name', 'Email', 'Role', 'Phone', 'Access', 'Approval', 'Stage Access', 'Joined', 'Action'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isPending = u.approvalStatus === 'pending'
              const isRejected = u.approvalStatus === 'rejected'
              const isSelf = currentUser?._id === u._id

              return (
                <tr key={u._id}>
                  <td style={{ fontSize:20 }}>{ROLE_ICONS[u.role] || '👤'}</td>
                  <td style={{ fontWeight:500 }}>{u.name}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{u.email}</td>
                  <td><span className="badge badge-indigo">{u.role}</span></td>
                  <td style={{ fontSize:12 }}>{u.phone || '—'}</td>
                  <td><span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Blocked'}</span></td>
                  <td>
                    <span className={`badge ${isPending ? 'badge-sun' : isRejected ? 'badge-red' : 'badge-green'}`}>
                      {u.approvalStatus || (u.isActive ? 'approved' : 'pending')}
                    </span>
                  </td>
                  <td><span className="badge badge-sun">{ROLE_STAGE_MAP[u.role] || 'All Stages'}</span></td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    {!isSelf && (
                      <div className="dashboard-inline-actions" style={{ gap:6 }}>
                        {isPending && (
                          <button className="btn btn-success btn-sm" disabled={actioningId === u._id} onClick={() => handleApprove(u._id)}>
                            Approve
                          </button>
                        )}
                        {(isPending || !isRejected) && (
                          <button className="btn btn-danger btn-sm" disabled={actioningId === u._id} onClick={() => handleReject(u._id)}>
                            Reject
                          </button>
                        )}
                        {isRejected && (
                          <button className="btn btn-success btn-sm" disabled={actioningId === u._id} onClick={() => handleApprove(u._id)}>
                            Re-Approve
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="crm-mobile-cards">
          {users.map((u) => {
            const isPending = u.approvalStatus === 'pending'
            const isRejected = u.approvalStatus === 'rejected'
            const isSelf = currentUser?._id === u._id

            return (
              <div key={u._id} className="crm-mobile-card">
                <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>{u.name}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{u.email}</div>
                  </div>
                  <span className="badge badge-indigo">{u.role}</span>
                </div>

                {[
                  ['Phone', u.phone || '-'],
                  ['Access', u.isActive ? 'Active' : 'Blocked'],
                  ['Approval', u.approvalStatus || (u.isActive ? 'approved' : 'pending')],
                  ['Stage', ROLE_STAGE_MAP[u.role] || 'All Stages'],
                  ['Joined', new Date(u.createdAt).toLocaleDateString('en-IN')],
                ].map(([label, value]) => (
                  <div key={label} className="crm-mobile-row">
                    <span className="crm-mobile-label">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}

                {!isSelf && (
                  <div className="dashboard-inline-actions" style={{ marginTop:10 }}>
                    {isPending && (
                      <button className="btn btn-success btn-sm" disabled={actioningId === u._id} onClick={() => handleApprove(u._id)}>
                        Approve
                      </button>
                    )}
                    {(isPending || !isRejected) && (
                      <button className="btn btn-danger btn-sm" disabled={actioningId === u._id} onClick={() => handleReject(u._id)}>
                        Reject
                      </button>
                    )}
                    {isRejected && (
                      <button className="btn btn-success btn-sm" disabled={actioningId === u._id} onClick={() => handleApprove(u._id)}>
                        Re-Approve
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TT = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text)' }

export function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  useEffect(() => { dashboardAPI.getStats().then(r => setStats(r.data.data)).catch(console.error) }, [])
  if (!stats) return <Spinner />

  const { summary, stageData, sourceData, monthlyData } = stats

  return (
    <div className="dashboard-page">
      <PageHeader icon="📈" title="Analytics" subtitle="Pipeline analytics and conversion metrics" />

      <div className="dashboard-grid-metrics" style={{ gap:14 }}>
        {[
          { label:'Total Leads', val: summary.total, color:'#F59E0B' },
          { label:'Active', val: summary.active, color:'#3B82F6' },
          { label:'Completed', val: summary.completed, color:'#10B981' },
          { label:'Rejected', val: summary.rejected, color:'#EF4444' },
          { label:'Conv. Rate', val: `${summary.conversionRate}%`, color:'#6366F1' },
          { label:'Enquiries', val: summary.enquiries, color:'#EC4899' },
        ].map(m => (
          <div key={m.label} className="metric-card">
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:700, color:m.color }}>{m.val}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid-two" style={{ marginBottom:16 }}>
        <div className="crm-card">
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Monthly Leads</h3>
          <div style={{ height:220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill:'var(--muted)', fontSize:11 }} />
                <YAxis tick={{ fill:'var(--muted)', fontSize:11 }} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="leads" stroke="#F59E0B" fill="rgba(245,158,11,.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crm-card">
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Lead Sources</h3>
          <div style={{ height:220 }}>
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
        <div className="crm-card" style={{ gridColumn:'1/-1' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Leads by Stage</h3>
          <div style={{ height:220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ left:-20, bottom:40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill:'var(--muted)', fontSize:10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill:'var(--muted)', fontSize:10 }} />
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
  const { user } = useAuthStore()
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirm:'' })
  const [saving, setSaving] = useState(false)

  const changePass = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password changed successfully!')
      setForm({ currentPassword:'', newPassword:'', confirm:'' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-page" style={{ maxWidth:600 }}>
      <PageHeader icon={ROLE_ICONS[user?.role]} title="My Profile" subtitle="Your account information and security settings" />
      <div className="crm-card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,rgba(245,158,11,.2),rgba(249,115,22,.1))', border:'1px solid rgba(245,158,11,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{ROLE_ICONS[user?.role] || '👤'}</div>
          <div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>{user?.name}</h2>
            <span className="badge badge-indigo">{user?.role}</span>
          </div>
        </div>
        {[['Email', user?.email], ['Phone', user?.phone || '—'], ['Stage Access', ROLE_STAGE_MAP[user?.role] || 'All Stages'], ['Last Login', user?.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : '—']].map(([k, v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, color:'var(--muted)' }}>{k}</span>
            <span style={{ fontSize:13, fontWeight:500 }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="crm-card">
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:16 }}>Change Password</h3>
        <form onSubmit={changePass}>
          {[['Current Password', 'currentPassword'], ['New Password', 'newPassword'], ['Confirm New Password', 'confirm']].map(([label, key]) => (
            <div key={key} style={{ marginBottom:14 }}>
              <label className="form-label">{label}</label>
              <input className="crm-input" type="password" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  )
}

export default UsersPage
