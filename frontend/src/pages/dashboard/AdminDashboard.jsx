import { useEffect, useMemo, useRef, useState } from 'react'
import { FaBell, FaCheckCircle, FaClipboardList, FaCog, FaTasks, FaUsers, FaWarehouse } from 'react-icons/fa'
import { Link, useSearchParams } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardAPI, enquiriesAPI, leadsAPI } from '../../services/api'
import { EmptyState, MetricCard, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'
import { getCitiesForState, STAGES, STAGE_COLORS, STATE_OPTIONS, stageColor } from '../../utils/constants'

const TT_STYLE = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text)' }
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const ENQUIRY_TYPES = ['Service Enquiry', 'Sales Enquiry', 'Installation Enquiry', 'Support Enquiry', 'Other']
const CAPITALIZED_ENQUIRY_FIELDS = new Set(['name', 'address', 'state', 'city', 'notes'])
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)
const VALID_TABS = ['overview', 'leads', 'pipeline', 'analytics']
const LEADS_PAGE_SIZE = 25
const PIPELINE_QUERY = { sort: 'latest', limit: 1000 }
const normalizeTab = (value) => VALID_TABS.includes(value) ? value : 'overview'
const getRequestError = (label, error) => `${label}: ${error?.response?.data?.message || error?.message || 'Request failed'}`

function AdminPipeline({ leads, onView }) {
  const [expandedStages, setExpandedStages] = useState({})
  const toggleStage = (stage) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }))
  }

  return (
    <div className="kanban-wrap" style={{ overflowX: 'auto' }}>
      {STAGES.map(stage => {
        const cols = leads.filter(l => l.currentStage === stage)
        const isExpanded = Boolean(expandedStages[stage])
        const visibleLeads = isExpanded ? cols : cols.slice(0, 5)
        return (
          <div key={stage} className="kanban-col">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: stageColor(stage) }}>{stage.split(' ')[0]}</div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11, padding: '1px 7px' }}>{cols.length}</div>
            </div>
            {visibleLeads.map(l => (
              <div key={l._id} className="kanban-card" onClick={() => onView(l)}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.capacity} | {l.city}</div>
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {STAGES.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= STAGES.indexOf(stage) ? stageColor(stage) : 'var(--bg3)' }} />)}
                </div>
              </div>
            ))}
            {cols.length > 5 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleStage(stage)}
                style={{ width: '100%', justifyContent: 'center', marginTop: 6, fontSize: 11 }}
              >
                {isExpanded ? 'Show less' : `+${cols.length - 5} more`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [leads, setLeads] = useState([])
  const [pipelineLeads, setPipelineLeads] = useState([])
  const [leadPagination, setLeadPagination] = useState({ page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
  const [leadQuery, setLeadQuery] = useState({ page: 1, sort: 'latest' })
  const [tab, setTab] = useState(() => normalizeTab(searchParams.get('tab')))
  const [selectedLead, setSelectedLead] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [dashboardErrors, setDashboardErrors] = useState([])
  const [leadError, setLeadError] = useState('')
  const [pipelineError, setPipelineError] = useState('')
  const leadRequestId = useRef(0)
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
    setDashboardLoading(true)
    setDashboardErrors([])
    Promise.allSettled([
      dashboardAPI.getStats(),
      dashboardAPI.getActivity(),
    ])
      .then(([statsResult, activityResult]) => {
        const errors = []

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value.data.data)
        } else {
          errors.push(getRequestError('Stats', statsResult.reason))
        }

        if (activityResult.status === 'fulfilled') {
          setActivity(activityResult.value.data.data || [])
        } else {
          errors.push(getRequestError('Activity', activityResult.reason))
        }

        setDashboardErrors(errors)
      })
      .catch(console.error)
      .finally(() => setDashboardLoading(false))
  }

  const loadLeads = (query = leadQuery) => {
    const requestId = leadRequestId.current + 1
    leadRequestId.current = requestId
    setLeadsLoading(true)
    setLeadError('')
    leadsAPI.getAll({ limit: LEADS_PAGE_SIZE, ...query})
      .then((response) => {
        if (requestId !== leadRequestId.current) return
        setLeads(response.data.data || [])
        setLeadPagination(response.data.pagination || { page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
      })
      .catch((error) => {
        if (requestId !== leadRequestId.current) return
        setLeads([])
        setLeadPagination({ page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
        setLeadError(error?.response?.data?.message || error?.message || 'Failed to load leads')
      })
      .finally(() => {
        if (requestId === leadRequestId.current) setLeadsLoading(false)
      })
  }

  const loadPipeline = () => {
    setPipelineLoading(true)
    setPipelineError('')
    leadsAPI.getAll(PIPELINE_QUERY)
      .then((response) => setPipelineLeads(response.data.data || []))
      .catch((error) => {
        setPipelineLeads([])
        setPipelineError(error?.response?.data?.message || error?.message || 'Failed to load pipeline')
      })
      .finally(() => setPipelineLoading(false))
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    const rawTab = searchParams.get('tab')
    if (rawTab && !VALID_TABS.includes(rawTab)) {
      setSearchParams({}, { replace: true })
      return
    }
    const nextTab = rawTab || 'overview'
    if (nextTab && nextTab !== tab) setTab(nextTab)
  }, [searchParams, setSearchParams, tab])

  useEffect(() => {
    if (tab === 'leads') loadLeads(leadQuery)
  }, [tab, leadQuery])

  useEffect(() => {
    if (tab === 'pipeline') loadPipeline()
  }, [tab])

  const selectTab = (nextTab) => {
    setTab(nextTab)
    if (nextTab === 'overview') {
      setSearchParams({})
      return
    }
    setSearchParams({ tab: nextTab })
  }

  const viewLead = (lead) => {
    setSelectedLead(lead)
    leadsAPI.getOne(lead._id)
      .then((response) => setSelectedLead(response.data.data))
      .catch(() => setSelectedLead(lead))
  }

  const handleLeadQueryChange = (query) => {
    setLeadQuery({ page: 1, sort: 'latest', ...query })
  }

  const refreshDashboardAndLeads = () => {
    loadDashboard()
    if (tab === 'leads') loadLeads(leadQuery)
    if (tab === 'pipeline') loadPipeline()
  }

  const {
    summary = {},
    stageData = [],
    sourceData = [],
    monthlyData = [],
    pendingEnquiries = [],
    pendingRegistrationCount = 0,
    pendingRegistrations = [],
  } = stats || {}

  const enquiryStats = useMemo(() => ({
    pending: pendingEnquiries,
  }), [pendingEnquiries])

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
    setEditingEnquiry(null)
    loadDashboard()
  }

  const updateEnquiryField = (key, value) => {
    const nextValue = CAPITALIZED_ENQUIRY_FIELDS.has(key) ? capitalizeFirstLetter(value) : value
    setEditForm((prev) => {
      if (key === 'state') return { ...prev, state: nextValue, city: '' }
      return { ...prev, [key]: nextValue }
    })
  }

  const registrationStats = useMemo(() => {
    return {
      pendingCount: pendingRegistrationCount,
      recentPending: pendingRegistrations,
    }
  }, [pendingRegistrationCount, pendingRegistrations])

  if (dashboardLoading) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaCog />} title="Admin Dashboard" subtitle="System overview only. Open other dashboards from the sidebar." />

      <div className="crm-tabs">
        {[
          ['overview', 'Overview'],
          ['leads', 'Leads'],
          ['pipeline', 'Pipeline'],
          ['analytics', 'Analytics'],
        ].map(([key, label]) => (
          <button key={key} className={`crm-tab ${tab === key ? 'active' : ''}`} onClick={() => selectTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {dashboardErrors.length > 0 && (
        <div className="crm-card" style={{ marginBottom:20, borderColor:'rgba(239,68,68,.35)', color:'var(--red)' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Some dashboard data could not be loaded.</div>
          {dashboardErrors.map((message) => (
            <div key={message} style={{ fontSize:12 }}>{message}</div>
          ))}
        </div>
      )}

      {tab === 'overview' && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          <div className="dashboard-grid-metrics">
            <MetricCard icon={<FaClipboardList />} label="Total Leads" value={summary?.total} change="+12 this week" changeColor="var(--sun)" onClick={() => selectTab('leads')} />
            <MetricCard icon={<FaTasks />} label="Active" value={summary?.active} change="In pipeline" changeColor="var(--blue)" onClick={() => selectTab('leads')} />
            <MetricCard icon={<FaCheckCircle />} label="Completed" value={summary?.completed} change={`${summary?.conversionRate}% conversion`} changeColor="var(--green)" onClick={() => selectTab('leads')} />
            <MetricCard icon={<FaBell />} label="Enquiries" value={summary?.enquiries} change="Website forms" changeColor="var(--indigo)" onClick={() => selectTab('leads')} />
            <MetricCard icon={<FaUsers />} label="Pending Registrations" value={registrationStats.pendingCount} change="Admin approval queue" changeColor="var(--red)" onClick={() => selectTab('leads')} />
            <MetricCard icon={<FaWarehouse />} label="Stock Manager Dashboard" value="Open" change="Inventory & dispatch ERP" changeColor="var(--green)" onClick={() => selectTab('leads')} />
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
          {leadError && (
            <div style={{ color:'var(--red)', fontSize:13, marginBottom:12 }}>{leadError}</div>
          )}
          <LeadsTable
            leads={leads}
            loading={leadsLoading}
            onView={viewLead}
            pagination={leadPagination}
            onQueryChange={handleLeadQueryChange}
            onLeadUpdated={refreshDashboardAndLeads}
          />
        </div>
      )}

      {tab === 'pipeline' && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          {pipelineError && (
            <div className="crm-card" style={{ marginBottom:16, color:'var(--red)', fontSize:13 }}>{pipelineError}</div>
          )}
          {pipelineLoading ? <Spinner /> : <AdminPipeline leads={pipelineLeads} onView={viewLead} />}
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

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={refreshDashboardAndLeads}
          currentUser={user}
        />
      )}
    </div>
  )
}
