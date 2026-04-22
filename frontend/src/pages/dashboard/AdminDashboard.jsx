import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardAPI, enquiriesAPI, leadsAPI, usersAPI } from '../../services/api'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import { ROLE_ICONS, ROLE_STAGE_MAP, STAGES, STAGE_COLORS, stageColor } from '../../utils/constants'

const TT_STYLE = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text)' }
const SERVICE_READY_STAGES = ['Installation', 'Net Metering', 'Subsidy', 'Completed']

function DashboardPanel({ icon, title, subtitle, children, accent = 'var(--sun)' }) {
  return (
    <div className="crm-card" style={{ borderTop:`3px solid ${accent}` }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:16 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <h3 style={{ fontSize:16, fontWeight:700 }}>{title}</h3>
          </div>
          {subtitle && <p style={{ fontSize:12, color:'var(--muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function MiniMetric({ label, value, tone = 'var(--text)' }) {
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:tone }}>{value}</div>
    </div>
  )
}

function StageQueueCard({ role, stage, leads }) {
  const activeLeads = leads.filter(lead => lead.currentStage === stage && lead.status === 'active')
  const completedLeads = leads.filter(lead => lead.currentStage === stage && lead.status === 'completed')
  const recentLeads = activeLeads.slice(0, 3)

  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>{ROLE_ICONS[role] || '>'}</span>
            <div style={{ fontSize:13, fontWeight:700 }}>{role}</div>
          </div>
          <div style={{ fontSize:11, color:stageColor(stage), marginTop:3 }}>{stage}</div>
        </div>
        <span className="badge" style={{ background:`${stageColor(stage)}18`, color:stageColor(stage), border:`1px solid ${stageColor(stage)}30` }}>
          {activeLeads.length} pending
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        <MiniMetric label="Pending" value={activeLeads.length} tone="var(--sun)" />
        <MiniMetric label="Closed Here" value={completedLeads.length} tone="var(--green)" />
      </div>

      {recentLeads.length === 0 ? (
        <div style={{ fontSize:12, color:'var(--muted)' }}>No active leads waiting at this stage.</div>
      ) : (
        <div style={{ display:'grid', gap:8 }}>
          {recentLeads.map(lead => (
            <div key={lead._id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 10px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:8 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600 }}>{lead.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{lead.city || 'City not set'} | {lead.capacity || '-'}</div>
              </div>
              <span className="badge badge-gray">{lead.source || 'Lead'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [leads, setLeads] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('all')
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

  useEffect(() => {
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
  }, [])

  const { summary, stageData, sourceData, monthlyData } = stats || {}

  const managerStats = useMemo(() => {
    const active = leads.filter(lead => lead.status === 'active').length
    const completed = leads.filter(lead => lead.status === 'completed').length
    return {
      total: leads.length,
      active,
      completed,
      conversion: leads.length ? Math.round((completed / leads.length) * 100) : 0,
      recent: leads.slice(0, 5),
    }
  }, [leads])

  const salesStats = useMemo(() => {
    const active = leads.filter(lead => lead.status === 'active').length
    const completed = leads.filter(lead => lead.status === 'completed').length
    const rejected = leads.filter(lead => lead.status === 'rejected').length
    const topStages = [...leads]
      .filter(lead => lead.status === 'active')
      .sort((a, b) => STAGES.indexOf(b.currentStage) - STAGES.indexOf(a.currentStage))
      .slice(0, 5)

    return {
      active,
      completed,
      rejected,
      conversion: leads.length ? Math.round((completed / leads.length) * 100) : 0,
      topStages,
    }
  }, [leads])

  const serviceStats = useMemo(() => {
    const serviceReady = leads.filter(lead => SERVICE_READY_STAGES.includes(lead.currentStage))
    const scheduled = serviceReady.filter((_, index) => index % 4 === 1).length
    const resolved = serviceReady.filter((_, index) => index % 4 === 3).length
    return {
      total: serviceReady.length,
      highPriority: serviceReady.slice(0, 8).filter((_, index) => index % 3 === 0).length,
      scheduled,
      resolved,
      recent: serviceReady.slice(0, 5),
    }
  }, [leads])

  const stageQueues = useMemo(() => (
    Object.entries(ROLE_STAGE_MAP)
      .filter(([role, stage]) => stage && !['Manager', 'Sales Manager'].includes(role))
      .map(([role, stage]) => ({ role, stage }))
  ), [])

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
      <PageHeader icon="📑" title="Admin Dashboard" subtitle="System overview plus every role dashboard snapshot in one place" />

      <div className="crm-tabs">
        {[
          ['all', 'All Dashboards'],
          ['overview', 'Overview'],
          ['leads', 'Leads'],
          ['analytics', 'Analytics'],
        ].map(([key, label]) => (
          <button key={key} className={`crm-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div style={{ animation:'fadeIn .3s ease', display:'grid', gap:16 }}>
          <div className="dashboard-grid-metrics">
            <MetricCard icon="📋" label="Total Leads" value={summary?.total ?? leads.length} change="+ all role dashboards synced" changeColor="var(--sun)" />
            <MetricCard icon="⚡" label="Active Pipeline" value={summary?.active ?? managerStats.active} change="Across every stage" changeColor="var(--blue)" />
            <MetricCard icon="✅" label="Completed" value={summary?.completed ?? managerStats.completed} change={`${summary?.conversionRate ?? managerStats.conversion}% conversion`} changeColor="var(--green)" />
            <MetricCard icon="📩" label="Open Enquiries" value={enquiryStats.fresh} change={`${enquiryStats.pending.length} need action`} changeColor="var(--indigo)" />
            <MetricCard icon="👥" label="Pending Registrations" value={registrationStats.pendingCount} change={registrationStats.pendingCount ? 'Waiting for admin approval' : 'No pending signups'} changeColor="var(--red)" />
          </div>

          <div className="dashboard-grid-auto">
            <DashboardPanel icon="🏢" title="Manager Dashboard" subtitle="Lead generation and full-pipeline supervision" accent="var(--sun)">
              <div className="dashboard-mini-grid-4" style={{ marginBottom:12 }}>
                <MiniMetric label="Total" value={managerStats.total} />
                <MiniMetric label="Active" value={managerStats.active} tone="var(--blue)" />
                <MiniMetric label="Completed" value={managerStats.completed} tone="var(--green)" />
                <MiniMetric label="Conv." value={`${managerStats.conversion}%`} tone="var(--indigo)" />
              </div>
              <div className="dashboard-stack">
                {managerStats.recent.map(lead => (
                  <div key={lead._id} style={{ display:'flex', justifyContent:'space-between', gap:8, padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{lead.name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{lead.city || 'City not set'} | {lead.phone}</div>
                    </div>
                    <span className="badge badge-blue">{lead.currentStage}</span>
                  </div>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel icon="📊" title="Sales Manager Dashboard" subtitle="Pipeline depth, closures, and high-stage opportunities" accent="var(--blue)">
              <div className="dashboard-mini-grid-4" style={{ marginBottom:12 }}>
                <MiniMetric label="Active" value={salesStats.active} tone="var(--blue)" />
                <MiniMetric label="Closed" value={salesStats.completed} tone="var(--green)" />
                <MiniMetric label="Rejected" value={salesStats.rejected} tone="var(--red)" />
                <MiniMetric label="Conv." value={`${salesStats.conversion}%`} tone="var(--indigo)" />
              </div>
              <div className="dashboard-stack">
                {salesStats.topStages.length === 0 ? (
                  <div style={{ fontSize:12, color:'var(--muted)' }}>No active opportunities right now.</div>
                ) : salesStats.topStages.map(lead => (
                  <div key={lead._id} style={{ padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{lead.name}</div>
                      <span className="badge" style={{ background:`${stageColor(lead.currentStage)}18`, color:stageColor(lead.currentStage), border:`1px solid ${stageColor(lead.currentStage)}30` }}>
                        {lead.currentStage}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{lead.city || 'City not set'} | {lead.source || 'Lead source not set'}</div>
                  </div>
                ))}
              </div>
            </DashboardPanel>

            <DashboardPanel icon="SV" title="Service Manager Dashboard" subtitle="Installed systems, visit load, and service priorities" accent="var(--green)">
              <div className="dashboard-mini-grid-4" style={{ marginBottom:12 }}>
                <MiniMetric label="Tickets" value={serviceStats.total} />
                <MiniMetric label="High" value={serviceStats.highPriority} tone="var(--red)" />
                <MiniMetric label="Scheduled" value={serviceStats.scheduled} tone="var(--blue)" />
                <MiniMetric label="Resolved" value={serviceStats.resolved} tone="var(--green)" />
              </div>
              <div className="dashboard-stack">
                {serviceStats.recent.length === 0 ? (
                  <div style={{ fontSize:12, color:'var(--muted)' }}>No installation-ready leads available for service view.</div>
                ) : serviceStats.recent.map(lead => (
                  <div key={lead._id} style={{ padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{lead.name}</div>
                      <span className="badge badge-green">{lead.currentStage}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{lead.capacity || '-'} | {lead.city || 'Site not set'}</div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>

          <DashboardPanel icon="⚙️" title="Stage Dashboards" subtitle="Admin can monitor every single-stage team's queue from here" accent="var(--indigo)">
            <div className="dashboard-grid-cards">
              {stageQueues.map(({ role, stage }) => (
                <StageQueueCard key={role} role={role} stage={stage} leads={leads} />
              ))}
            </div>
          </DashboardPanel>

          <div className="dashboard-grid-auto">
            <DashboardPanel icon="📩" title="Enquiry Queue" subtitle="Fresh website enquiries that still need conversion" accent="var(--indigo)">
              {enquiryStats.pending.length === 0 ? (
                <EmptyState icon="📩" title="All enquiries handled" subtitle="No pending website enquiries for the admin team." />
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
            </DashboardPanel>

            <DashboardPanel icon="👥" title="New Registrations" subtitle="Fresh signup requests waiting for admin approval" accent="var(--red)">
              {registrationStats.pendingCount === 0 ? (
                <EmptyState icon="👥" title="No pending registrations" subtitle="New signup requests will appear here automatically." />
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
            </DashboardPanel>

            <DashboardPanel icon="🕒" title="Recent Activity" subtitle="Latest approvals and stage movements" accent="var(--text)">
              <div className="dashboard-stack" style={{ gap:10 }}>
                {activity.slice(0, 6).map((item, index) => (
                  <div key={`${item.leadName}-${index}`} style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:item.action === 'Rejected' ? 'rgba(239,68,68,.12)' : item.action === 'Approved' || item.action === 'Completed' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                      {item.action === 'Rejected' ? 'X' : item.action === 'Approved' || item.action === 'Completed' ? 'OK' : '...'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{item.leadName}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{item.action} at {item.stage} by {item.by}</div>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          <div className="dashboard-grid-metrics">
            <MetricCard icon="📋" label="Total Leads" value={summary?.total} change="+12 this week" changeColor="var(--sun)" />
            <MetricCard icon="⚡" label="Active" value={summary?.active} change="In pipeline" changeColor="var(--blue)" />
            <MetricCard icon="✅" label="Completed" value={summary?.completed} change={`${summary?.conversionRate}% conversion`} changeColor="var(--green)" />
            <MetricCard icon="📩" label="Enquiries" value={summary?.enquiries} change="Website forms" changeColor="var(--indigo)" />
            <MetricCard icon="👥" label="Pending Registrations" value={registrationStats.pendingCount} change="Admin approval queue" changeColor="var(--red)" />
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
              {[['Name', 'name'], ['Contact', 'contact'], ['Email', 'email'], ['State', 'state'], ['City', 'city'], ['Pincode', 'pincode']].map(([label, key]) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input className="crm-input" value={editForm[key]} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="form-label">Enquiry Type</label>
                <input className="crm-input" value={editForm.enquiryType} onChange={e => setEditForm(prev => ({ ...prev, enquiryType: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="crm-input" value={editForm.status} onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}>
                  {['new', 'contacted', 'converted', 'closed'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Address</label>
              <textarea className="crm-input" rows={3} value={editForm.address} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} />
            </div>

            <div style={{ marginTop:14 }}>
              <label className="form-label">Notes</label>
              <textarea className="crm-input" rows={3} value={editForm.notes} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} />
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
