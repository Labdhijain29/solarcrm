import { useEffect, useMemo, useState } from 'react'
import { FaBell, FaCheckCircle, FaClipboardList, FaCog, FaTasks, FaUsers, FaWarehouse } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardAPI, enquiriesAPI, leadsAPI, usersAPI } from '../../services/api'
import { EmptyState, MetricCard, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import { getCitiesForState, STAGE_COLORS, STATE_OPTIONS } from '../../utils/constants'

const TT_STYLE = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text)' }
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']
export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [leads, setLeads] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [editingEnquiry, setEditingEnquiry] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    contact: '',
    email: '',
    address: '',
    enquiryType: '',
    state: '',
    city: '',
    pincode: '',
    status: 'new',
    notes: '',
  })

  const loadDashboard = () => {
    setLoading(true)
    Promise.all([
      dashboardAPI.getStats(),
      dashboardAPI.getActivity(),
      leadsAPI.getAll(),
      enquiriesAPI.getAll(),
      usersAPI.getAll(),
    ])
      .then(([statsRes, activityRes, leadsRes, enquiriesRes, usersRes]) => {
        setStats(statsRes.data.data)
        setActivity(activityRes.data.data || [])
        setLeads(leadsRes.data.data || [])
        setEnquiries(enquiriesRes.data.data || [])
        setUsers(usersRes.data.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const { summary, stageData, sourceData, monthlyData } = stats || {}

  const enquiryStats = useMemo(() => ({
    total: enquiries.length,
    fresh: enquiries.filter(item => item.status === 'new').length,
    converted: enquiries.filter(item => item.status === 'converted').length,
    pending: enquiries.filter(item => item.status !== 'converted').slice(0, 4),
  }), [enquiries])

  const openEditEnquiry = (enquiry) => {
    setEditingEnquiry(enquiry)
    setEditForm({
      name: enquiry.name || '',
      contact: enquiry.contact || enquiry.phone || '',
      email: enquiry.email || '',
      address: enquiry.address || '',
      enquiryType: enquiry.enquiryType || '',
      state: enquiry.state || '',
      city: enquiry.city || '',
      pincode: enquiry.pincode || '',
      status: enquiry.status || 'new',
      notes: enquiry.notes || '',
    })
  }

  const saveEnquiryEdit = async () => {
    if (!editingEnquiry) return
    await enquiriesAPI.update(editingEnquiry._id, editForm)
    const enquiriesRes = await enquiriesAPI.getAll()
    setEnquiries(enquiriesRes.data.data || [])
    setEditingEnquiry(null)
  }

  const updateEnquiryField = (key, value) => {
    setEditForm((prev) => {
      if (key === 'state') return { ...prev, state: value, city: '' }
      return { ...prev, [key]: value }
    })
  }

  const registrationStats = useMemo(() => {
    const pending = users.filter(user => user.approvalStatus === 'pending')

    return {
      pendingCount: pending.length,
      recentPending: pending.slice(0, 5),
    }
  }, [users])

  if (loading) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaCog />} title="Admin Dashboard" subtitle="System overview only. Open other dashboards from the sidebar." />

      <div className="crm-tabs">
        {[
          ['overview', 'Overview'],
          ['leads', 'Leads'],
          ['analytics', 'Analytics'],
        ].map(([key, label]) => (
          <button key={key} className={`crm-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          <div className="dashboard-grid-metrics">
            <MetricCard icon={<FaClipboardList />} label="Total Leads" value={summary?.total} change="+12 this week" changeColor="var(--sun)" />
            <MetricCard icon={<FaTasks />} label="Active" value={summary?.active} change="In pipeline" changeColor="var(--blue)" />
            <MetricCard icon={<FaCheckCircle />} label="Completed" value={summary?.completed} change={`${summary?.conversionRate}% conversion`} changeColor="var(--green)" />
            <MetricCard icon={<FaBell />} label="Enquiries" value={summary?.enquiries} change="Website forms" changeColor="var(--indigo)" />
            <MetricCard icon={<FaUsers />} label="Pending Registrations" value={registrationStats.pendingCount} change="Admin approval queue" changeColor="var(--red)" />
            <Link to="/dashboard/stock-manager" style={{ textDecoration:'none' }}>
              <MetricCard icon={<FaWarehouse />} label="Stock Manager Dashboard" value="Open" change="Inventory & dispatch ERP" changeColor="var(--green)" />
            </Link>
          </div>

          <div className="dashboard-grid-two" style={{ marginBottom:24 }}>
            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Leads by Stage</h3>
              <div style={{ height:220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top:0, right:0, left:-20, bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill:'var(--muted)', fontSize:10 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fill:'var(--muted)', fontSize:10 }} />
                    <Tooltip contentStyle={TT_STYLE} />
                    <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Lead Sources</h3>
              <div style={{ height:220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {(sourceData || []).map((_, index) => <Cell key={index} fill={['#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#F97316'][index % 6]} />)}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="crm-card">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Recent Activity</h3>
            {activity.slice(0, 8).map((item, index) => (
              <div key={index} className="history-item">
                <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:item.action === 'Approved' || item.action === 'Completed' ? 'rgba(16,185,129,.1)' : item.action === 'Rejected' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                  {item.action === 'Approved' || item.action === 'Completed' ? 'OK' : item.action === 'Rejected' ? 'X' : '...'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{item.leadName} | {item.stage}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{item.action} by {item.by}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--dim)' }}>{new Date(item.timestamp).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-grid-auto" style={{ marginTop:24 }}>
            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Pending Enquiries</h3>
              {enquiryStats.pending.length === 0 ? (
                <EmptyState icon={<FaBell />} title="All enquiries handled" subtitle="No pending website enquiries for the admin team." />
              ) : (
                <div className="dashboard-stack">
                  {enquiryStats.pending.map(enquiry => (
                    <div key={enquiry._id} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10 }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700 }}>{enquiry.name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{enquiry.contact || enquiry.phone} | {enquiry.city || 'City not set'}</div>
                        <div style={{ fontSize:11, color:'var(--dim)', marginTop:4 }}>{enquiry.enquiryType || 'General Enquiry'}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                        <span className={`badge ${enquiry.status === 'new' ? 'badge-sun' : 'badge-blue'}`}>{enquiry.status}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditEnquiry(enquiry)}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Pending Registrations</h3>
              {registrationStats.pendingCount === 0 ? (
                <EmptyState icon={<FaUsers />} title="No pending registrations" subtitle="New signup requests will appear here automatically." />
              ) : (
                <div className="dashboard-stack" style={{ gap:10 }}>
                  {registrationStats.recentPending.map(person => (
                    <div key={person._id} style={{ padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700 }}>{person.name}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{person.email}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{person.phone || 'Phone not set'} | {person.role}</div>
                        </div>
                        <span className="badge badge-sun">Pending</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginTop:10 }}>
                        <div style={{ fontSize:11, color:'var(--dim)' }}>
                          Joined {new Date(person.createdAt).toLocaleDateString('en-IN')}
                        </div>
                        <Link to="/dashboard/users" className="btn btn-ghost btn-sm">
                          Review
                        </Link>
                      </div>
                    </div>
                  ))}

                  <Link to="/dashboard/users" className="btn btn-secondary" style={{ justifyContent:'center' }}>
                    Open User Management
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="crm-card" style={{ animation:'fadeIn .3s ease' }}>
          <LeadsTable leads={leads} loading={false} />
        </div>
      )}

      {tab === 'analytics' && (
        <div className="dashboard-grid-two" style={{ animation:'fadeIn .3s ease' }}>
          <div className="crm-card">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Monthly Leads</h3>
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <YAxis tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Area type="monotone" dataKey="leads" stroke="#F59E0B" fill="rgba(245,158,11,.1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="crm-card">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Stage Distribution</h3>
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ left:-20, bottom:40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill:'var(--muted)', fontSize:9 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill:'var(--muted)', fontSize:10 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(stageData || []).map((_, index) => <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="crm-card" style={{ gridColumn:'1/-1' }}>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Stage Funnel</h3>
            <div className="dashboard-funnel">
              {(stageData || []).map((stageItem, index) => {
                const max = Math.max(...(stageData || []).map(entry => entry.count), 1)
                const pct = (stageItem.count / max) * 100
                return (
                  <div key={stageItem.name} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:STAGE_COLORS[index] }}>{stageItem.count}</div>
                    <div style={{ width:'100%', background:`${STAGE_COLORS[index]}20`, borderRadius:4, height:100, display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', background:STAGE_COLORS[index], borderRadius:4, height:`${pct}%`, minHeight:4, transition:'height .5s' }} />
                    </div>
                    <div style={{ fontSize:8, color:'var(--muted)', textAlign:'center', lineHeight:1.2 }}>{stageItem.name.split(' ')[0]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {editingEnquiry && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditingEnquiry(null)}>
          <div className="modal-box" style={{ maxWidth:720 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Edit Enquiry</h2>
              <button onClick={() => setEditingEnquiry(null)} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
            </div>

            <div className="dashboard-form-grid">
              {[['Name', 'name'], ['Contact', 'contact'], ['Email', 'email'], ['Pincode', 'pincode']].map(([label, key]) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input className="crm-input" value={editForm[key]} onChange={e => updateEnquiryField(key, e.target.value)} />
                </div>
              ))}
              <div>
                <label className="form-label">State</label>
                <SearchableSelect
                  name="edit-enquiry-state"
                  value={editForm.state}
                  onChange={(value) => updateEnquiryField('state', value)}
                  options={toOptions(STATE_OPTIONS)}
                  placeholder="Select state..."
                  searchPlaceholder="Search state..."
                />
              </div>
              <div>
                <label className="form-label">City</label>
                <SearchableSelect
                  name="edit-enquiry-city"
                  value={editForm.city}
                  onChange={(value) => updateEnquiryField('city', value)}
                  options={toOptions(getCitiesForState(editForm.state))}
                  placeholder={editForm.state ? 'Select city...' : 'Select state first'}
                  searchPlaceholder="Search city..."
                  noOptionsText={editForm.state ? 'No cities found' : 'Select state first'}
                  disabled={!editForm.state}
                />
              </div>
              <div>
                <label className="form-label">Enquiry Type</label>
                <SearchableSelect
                  name="edit-enquiry-type"
                  value={editForm.enquiryType}
                  onChange={(value) => updateEnquiryField('enquiryType', value)}
                  options={toOptions(ENQUIRY_TYPES)}
                  placeholder="Select enquiry type..."
                  searchPlaceholder="Search enquiry type..."
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="crm-input" value={editForm.status} onChange={e => updateEnquiryField('status', e.target.value)}>
                  {['new', 'contacted', 'converted', 'closed'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Address</label>
              <textarea className="crm-input" rows={3} value={editForm.address} onChange={e => updateEnquiryField('address', e.target.value)} />
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Notes</label>
              <textarea className="crm-input" rows={3} value={editForm.notes} onChange={e => updateEnquiryField('notes', e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:18 }} onClick={saveEnquiryEdit}>
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
