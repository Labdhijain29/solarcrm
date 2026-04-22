import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, LeadAvatar, PipelineBar, StageBadge, StatusBadge } from '../common'
import { SOURCES, STAGES } from '../../utils/constants'

export default function LeadsTable({ leads = [], loading, onView, extraActions }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [srcFilter, setSrc] = useState('All')
  const [statusFilter, setStatus] = useState('All')
  const [stageFilter, setStage] = useState('All')

  const filtered = leads.filter((lead) => {
    const q = search.toLowerCase()
    if (q && !lead.name?.toLowerCase().includes(q) && !lead.phone?.includes(q) && !lead.city?.toLowerCase().includes(q)) return false
    if (srcFilter !== 'All' && lead.source !== srcFilter) return false
    if (statusFilter !== 'All' && lead.status !== statusFilter) return false
    if (stageFilter !== 'All' && lead.currentStage !== stageFilter) return false
    return true
  })

  const handleView = (lead) => {
    if (onView) {
      onView(lead)
      return
    }
    navigate(`/dashboard/leads/${lead._id}`)
  }

  if (loading) {
    return <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Loading leads...</div>
  }

  if (filtered.length === 0) {
    return <EmptyState title="No leads found" subtitle="Try adjusting your search or filters" />
  }

  return (
    <div>
      <div className="dashboard-table-filters">
        <div className="dashboard-search">
          <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', fontSize:14 }}>SR</span>
          <input
            className="crm-input"
            style={{ paddingLeft:34 }}
            placeholder="Search name, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="crm-input" style={{ width:'auto' }} value={srcFilter} onChange={(e) => setSrc(e.target.value)}>
          {['All', ...SOURCES].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="crm-input" style={{ width:'auto' }} value={stageFilter} onChange={(e) => setStage(e.target.value)}>
          {['All', ...STAGES].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="crm-input" style={{ width:'auto' }} value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          {['All', 'active', 'completed', 'rejected', 'on-hold'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{filtered.length} leads</span>
      </div>

      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {['ID', 'Customer', 'City', 'Source', 'kW', 'Stage', 'Status', 'Progress', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead._id || lead.id}>
                <td><span style={{ fontFamily:'monospace', fontSize:11, color:'var(--muted)' }}>{lead._id?.slice(-6) || lead.id}</span></td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <LeadAvatar name={lead.name} size={32} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{lead.name}</div>
                      <div style={{ fontSize:11, color:'var(--dim)' }}>{lead.phone}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge badge-gray">{lead.city || '-'}</span></td>
                <td><span className="badge badge-blue">{lead.source}</span></td>
                <td><span style={{ fontWeight:600, color:'var(--sun)' }}>{lead.capacity}</span></td>
                <td><StageBadge stage={lead.currentStage} /></td>
                <td><StatusBadge status={lead.status} /></td>
                <td style={{ minWidth:120 }}><PipelineBar lead={lead} /></td>
                <td>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleView(lead)}>View</button>
                    {extraActions && extraActions(lead)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="crm-mobile-cards">
          {filtered.map((lead) => (
            <div key={lead._id || lead.id} className="crm-mobile-card">
              <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <LeadAvatar name={lead.name} size={34} />
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>{lead.name}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{lead.phone}</div>
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </div>

              {[
                ['City', lead.city || '-'],
                ['Source', lead.source || '-'],
                ['Capacity', lead.capacity || '-'],
              ].map(([label, value]) => (
                <div key={label} className="crm-mobile-row">
                  <span className="crm-mobile-label">{label}</span>
                  <span>{value}</span>
                </div>
              ))}

              <div style={{ padding:'8px 0' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Stage</div>
                <StageBadge stage={lead.currentStage} />
              </div>

              <div style={{ padding:'8px 0' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Progress</div>
                <PipelineBar lead={lead} />
              </div>

              <div className="dashboard-inline-actions" style={{ marginTop:10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleView(lead)}>View</button>
                {extraActions && extraActions(lead)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
