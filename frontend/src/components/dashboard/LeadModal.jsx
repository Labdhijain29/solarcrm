import { useState } from 'react'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { canActOnStage, formatDate, STAGES, stageIndex } from '../../utils/constants'
import { StageBadge, StageProgress, StatusBadge } from '../common'

export default function LeadModal({ lead, onClose, onUpdated, currentUser }) {
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)

  const currentIndex = stageIndex(lead.currentStage)
  const canAct = canActOnStage(currentUser?.role, lead.currentStage)
  const canApprove = canAct && lead.status === 'active' && currentIndex < STAGES.length - 1

  const doApprove = async () => {
    setLoading(true)
    try {
      await leadsAPI.approve(lead._id, { note: note || 'Approved' })
      toast.success(`Moved to ${STAGES[currentIndex + 1]}`)
      onUpdated?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve')
    } finally {
      setLoading(false)
    }
  }

  const doReject = async () => {
    if (!window.confirm(`Reject lead "${lead.name}"? This cannot be undone.`)) return
    setLoading(true)
    try {
      await leadsAPI.reject(lead._id, { note: note || 'Rejected' })
      toast.success('Lead rejected')
      onUpdated?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject')
    } finally {
      setLoading(false)
    }
  }

  const doAddNote = async () => {
    if (!note.trim()) return
    setLoading(true)
    try {
      await leadsAPI.addNote(lead._id, note)
      toast.success('Note added')
      setNote('')
      setShowNote(false)
      onUpdated?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add note')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    ['ID', lead._id?.slice(-8) || lead.id],
    ['Phone', lead.phone],
    ['City', lead.city || '-'],
    ['Source', lead.source || '-'],
    ['By / Through', lead.generatedThrough || '-'],
    ['Capacity', lead.capacity || '-'],
    ['Assigned', lead.assignedTo?.name || lead.assignedTo || '-'],
    ['Created', formatDate(lead.createdAt)],
    ['Status', lead.status],
  ]

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="dashboard-split-row" style={{ marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>{lead.name}</h2>
            <div className="dashboard-inline-actions" style={{ marginTop:6 }}>
              <StageBadge stage={lead.currentStage} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
        </div>

        <div className="dashboard-mini-grid-2" style={{ marginBottom:16 }}>
          {fields.map(([label, value]) => (
            <div key={label} className="crm-card-sm" style={{ padding:'8px 12px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-word' }}>{value}</div>
            </div>
          ))}
        </div>

        {lead.address && (
          <div style={{ marginBottom:14, fontSize:13, color:'var(--muted)' }}>
            <strong style={{ color:'var(--text)' }}>Address:</strong> {lead.address}
          </div>
        )}

        <div className="crm-card-sm" style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Pipeline Progress</div>
          <StageProgress lead={lead} />
        </div>

        <div className="crm-card-sm" style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Activity History</div>
          {(lead.history || []).map((item, index) => (
            <div key={index} className="history-item">
              <div style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0, background:item.action === 'Approved' || item.action === 'Completed' ? 'rgba(16,185,129,.1)' : item.action === 'Rejected' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)' }}>
                {item.action === 'Approved' || item.action === 'Completed' ? 'OK' : item.action === 'Rejected' ? 'NO' : '...'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{item.stage} | {item.action}</div>
                {item.performedByName && <div style={{ fontSize:12, color:'var(--muted)' }}>By: {item.performedByName}</div>}
                {item.note && <div style={{ fontSize:11, color:'var(--dim)' }}>{item.note}</div>}
              </div>
              <div style={{ fontSize:11, color:'var(--dim)', whiteSpace:'nowrap' }}>{formatDate(item.timestamp)}</div>
            </div>
          ))}
        </div>

        {showNote && (
          <div style={{ marginBottom:12 }}>
            <textarea
              className="crm-input"
              rows={2}
              placeholder="Add a note or reason..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        <div className="dashboard-inline-actions">
          {canApprove && (
            <button className="btn btn-success" style={{ flex:1 }} disabled={loading} onClick={doApprove}>
              Approve {'->'} {STAGES[currentIndex + 1]}
            </button>
          )}
          {canAct && lead.status === 'active' && (
            <button className="btn btn-danger" disabled={loading} onClick={doReject}>Reject</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(!showNote)}>Note</button>
          {showNote && note && (
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={doAddNote}>Save Note</button>
          )}
        </div>
      </div>
    </div>
  )
}
