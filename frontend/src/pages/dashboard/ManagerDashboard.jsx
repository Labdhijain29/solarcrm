import { useState, useEffect } from 'react'
import { leadsAPI } from '../../services/api'
import { MetricCard, PageHeader, Spinner, EmptyState } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'
import { STAGES, ROLE_STAGE_MAP, stageColor } from '../../utils/constants'
import toast from 'react-hot-toast'

function KanbanPipeline({ leads, onView }) {
  return (
    <div className="kanban-wrap" style={{ overflowX:'auto' }}>
      {STAGES.map(stage => {
        const cols = leads.filter(l => l.currentStage === stage)
        return (
          <div key={stage} className="kanban-col">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:stageColor(stage) }}>{stage.split(' ')[0]}</div>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, fontSize:11, padding:'1px 7px' }}>{cols.length}</div>
            </div>
            {cols.slice(0, 5).map(l => (
              <div key={l._id} className="kanban-card" onClick={() => onView(l)}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{l.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{l.capacity} | {l.city}</div>
                <div style={{ display:'flex', gap:2, marginTop:6 }}>
                  {STAGES.map((_, i) => <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= STAGES.indexOf(stage) ? stageColor(stage) : 'var(--bg3)' }} />)}
                </div>
              </div>
            ))}
            {cols.length > 5 && <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', padding:'6px 0' }}>+{cols.length - 5} more</div>}
          </div>
        )
      })}
    </div>
  )
}

export function ManagerDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('leads')
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newLead, setNewLead] = useState({ name:'', phone:'', city:'', source:'Website', capacity:'3kW' })
  const { user } = useAuthStore()

  const fetchLeads = () => {
    leadsAPI.getAll().then(r => setLeads(r.data.data)).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(fetchLeads, [])

  const createLead = async () => {
    const phone = String(newLead.phone || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '')
    if (!newLead.name.trim() || !phone) return toast.error('Name and phone are required')
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error('Enter a valid 10-digit mobile number')

    try {
      await leadsAPI.create({ ...newLead, name: newLead.name.trim(), phone })
      toast.success('Lead created!')
      setShowCreate(false)
      setNewLead({ name:'', phone:'', city:'', source:'Website', capacity:'3kW' })
      fetchLeads()
    } catch (e) {
      const validationMessage = e.response?.data?.errors?.[0]?.message
      toast.error(validationMessage || e.response?.data?.message || 'Failed to create lead')
    }
  }

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.status === 'active').length,
    completed: leads.filter(l => l.status === 'completed').length,
  }

  return (
    <div className="dashboard-page">
      <PageHeader
        icon="🏢"
        title="Manager Dashboard"
        subtitle="Generate leads, assign tasks, monitor the full pipeline"
        action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Lead</button>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon="📋" label="Total Leads" value={stats.total} changeColor="var(--sun)" />
        <MetricCard icon="⚡" label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon="✅" label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon="📈" label="Conv. Rate" value={`${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}%`} changeColor="var(--indigo)" />
      </div>

      <div className="crm-tabs">
        {['leads', 'pipeline'].map(t => (
          <button key={t} className={`crm-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'leads' && <div className="crm-card"><LeadsTable leads={leads} loading={loading} onView={setSelected} /></div>}
      {tab === 'pipeline' && <KanbanPipeline leads={leads} onView={setSelected} />}

      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Create New Lead</h2>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
            </div>
            <div className="dashboard-form-grid">
              {[['Full Name', 'name', 'text'], ['Phone', 'phone', 'tel'], ['City', 'city', 'text'], ['Capacity', 'capacity', 'text']].map(([label, key, type]) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input className="crm-input" type={type} value={newLead[key]} onChange={e => setNewLead(p => ({ ...p, [key]: e.target.value }))} placeholder={key === 'phone' ? '9876543210 or +91 98765 43210' : ''} />
                </div>
              ))}
              <div>
                <label className="form-label">Source</label>
                <select className="crm-input" value={newLead.source} onChange={e => setNewLead(p => ({ ...p, source: e.target.value }))}>
                  {['Website', 'Social Media', 'Referral', 'Cold Call', 'Exhibition', 'Google Ads'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:16 }} onClick={createLead}>Create Lead</button>
          </div>
        </div>
      )}

      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetchLeads} currentUser={user} />}
    </div>
  )
}

export function SalesDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const { user } = useAuthStore()

  useEffect(() => {
    leadsAPI.getAll().then(r => setLeads(r.data.data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.status === 'active').length,
    completed: leads.filter(l => l.status === 'completed').length,
    rejected: leads.filter(l => l.status === 'rejected').length,
  }

  return (
    <div className="dashboard-page">
      <PageHeader icon="📊" title="Sales Manager Dashboard" subtitle="Full pipeline overview and conversion tracking" />
      <div className="dashboard-grid-metrics">
        <MetricCard icon="📋" label="Total Leads" value={stats.total} />
        <MetricCard icon="⚡" label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon="✅" label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon="📈" label="Conv. Rate" value={`${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}%`} changeColor="var(--indigo)" />
      </div>
      <div className="crm-card">
        <LeadsTable leads={leads} loading={loading} onView={setSelected} />
      </div>
      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={() => leadsAPI.getAll().then(r => setLeads(r.data.data))} currentUser={user} />}
    </div>
  )
}

const STAGE_ROLE_ICONS = {
  'Registration Executive':'📝',
  'Bank/Finance Executive':'🏦',
  'Loan Officer':'💰',
  'Dispatch Manager':'🚚',
  'Installation Manager':'⚙️',
  'Net Metering Officer':'⚡',
  'Subsidy Officer':'🎁',
}

export function StageDashboard({ roleOverride }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const { user } = useAuthStore()
  const dashboardRole = roleOverride || user?.role
  const myStage = ROLE_STAGE_MAP[dashboardRole]

  const fetchLeads = () => {
    setLoading(true)
    leadsAPI.getAll({ stage: myStage, status: 'active' })
      .then(r => setLeads(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(fetchLeads, [myStage])

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={STAGE_ROLE_ICONS[dashboardRole] || '⚡'}
        title={`${dashboardRole} Dashboard`}
        subtitle={<>Stage: <strong style={{ color: stageColor(myStage) }}>{myStage}</strong> - review and action leads assigned to your stage</>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon="⏳" label="Pending Action" value={leads.length} changeColor="var(--sun)" />
        <MetricCard icon="🎯" label="My Stage" value={myStage?.split(' ')[0]} />
        <MetricCard icon="👤" label="Assigned to" value={roleOverride ? dashboardRole.split(' ')[0] : user?.name?.split(' ')[0]} />
      </div>

      {loading ? <Spinner /> : leads.length === 0 ? (
        <div className="crm-card">
          <EmptyState icon="🎉" title="All caught up!" subtitle={`No leads pending at the ${myStage} stage`} />
        </div>
      ) : (
        <div className="crm-card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>📋 Leads at {myStage} ({leads.length})</h3>
          <LeadsTable leads={leads} loading={false} onView={setSelected} />
        </div>
      )}

      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetchLeads} currentUser={user} />}
    </div>
  )
}

export default ManagerDashboard
