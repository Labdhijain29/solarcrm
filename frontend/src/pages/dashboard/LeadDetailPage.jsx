import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { leadsAPI } from '../../services/api'
import { StageProgress, StageBadge, StatusBadge, Spinner, PageHeader } from '../../components/common'
import { useAuthStore } from '../../store'
import { canActOnStage, STAGES, stageIndex, formatDate } from '../../utils/constants'
import toast from 'react-hot-toast'

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)

  const fetch = () => leadsAPI.getOne(id).then(r => setLead(r.data.data)).catch(() => navigate('/dashboard/leads')).finally(() => setLoading(false))
  useEffect(fetch, [id])

  if (loading) return <Spinner size={48} />
  if (!lead) return null

  const ci = stageIndex(lead.currentStage)
  const canAct = canActOnStage(user?.role, lead.currentStage)

  const doApprove = async () => {
    setActing(true)
    try {
      await leadsAPI.approve(id, { note: note || 'Approved' })
      toast.success(`Moved to ${STAGES[ci + 1]}`)
      fetch()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setActing(false) }
  }

  const doReject = async () => {
    if (!window.confirm('Reject this lead?')) return
    setActing(true)
    try {
      await leadsAPI.reject(id, { note: note || 'Rejected' })
      toast.success('Lead rejected')
      fetch()
    } catch (e) { toast.error('Failed') }
    finally { setActing(false) }
  }

  const doNote = async () => {
    if (!note.trim()) return
    try { await leadsAPI.addNote(id, note); toast.success('Note added'); setNote(''); fetch() }
    catch { toast.error('Failed') }
  }

  const fields = [
    ['Customer', lead.name], ['Phone', lead.phone], ['Email', lead.email || '—'],
    ['City', lead.city || '—'], ['State', lead.state || '—'], ['Pincode', lead.pincode || '—'],
    ['Source', lead.source], ['Capacity', lead.capacity], ['Roof Type', lead.roofType || '—'],
    ['Monthly Bill', lead.monthlyBill ? `₹${lead.monthlyBill.toLocaleString()}` : '—'],
    ['Assigned To', lead.assignedTo?.name || '—'], ['Created', formatDate(lead.createdAt)],
  ]

  return (
    <div style={{ animation:'fadeIn .4s ease', maxWidth:900 }}>
      <PageHeader
        icon="☀️"
        title={lead.name}
        subtitle={<div style={{ display:'flex', gap:8, marginTop:4 }}><StageBadge stage={lead.currentStage} /><StatusBadge status={lead.status} /></div>}
        action={<button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>}
      />

      {/* Pipeline */}
      <div className="crm-card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>Pipeline Progress</div>
        <StageProgress lead={lead} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Details */}
        <div className="crm-card">
          <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:14 }}>Lead Details</div>
          {fields.map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:500, textAlign:'right', maxWidth:'60%' }}>{v}</span>
            </div>
          ))}
          {lead.address && (
            <div style={{ padding:'8px 0', fontSize:12 }}>
              <span style={{ color:'var(--muted)' }}>Address: </span>{lead.address}
            </div>
          )}
        </div>

        {/* Actions + History */}
        <div>
          {/* Actions */}
          {canAct && lead.status === 'active' && (
            <div className="crm-card" style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:14 }}>Actions</div>
              <textarea className="crm-input" rows={2} placeholder="Add a note or reason…" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom:12 }} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {ci < STAGES.length - 1 && (
                  <button className="btn btn-success" style={{ flex:1 }} disabled={acting} onClick={doApprove}>
                    ✅ Approve → {STAGES[ci + 1]}
                  </button>
                )}
                <button className="btn btn-danger" disabled={acting} onClick={doReject}>❌ Reject</button>
                <button className="btn btn-ghost btn-sm" disabled={acting || !note.trim()} onClick={doNote}>📝 Save Note</button>
              </div>
            </div>
          )}

          {/* History */}
          <div className="crm-card">
            <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:14 }}>Activity History</div>
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {(lead.history || []).map((h, i) => (
                <div key={i} className="history-item">
                  <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background: h.action === 'Approved' || h.action === 'Completed' ? 'rgba(16,185,129,.1)' : h.action === 'Rejected' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)' }}>
                    {h.action === 'Approved' || h.action === 'Completed' ? '✅' : h.action === 'Rejected' ? '❌' : '⏳'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{h.stage} — {h.action}</div>
                    {h.performedByName && <div style={{ fontSize:11, color:'var(--muted)' }}>By {h.performedByName}</div>}
                    {h.note && <div style={{ fontSize:11, color:'var(--dim)', fontStyle:'italic' }}>{h.note}</div>}
                  </div>
                  <div style={{ fontSize:10, color:'var(--dim)', whiteSpace:'nowrap' }}>{formatDate(h.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
