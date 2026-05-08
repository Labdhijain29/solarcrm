import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FaExchangeAlt, FaHistory, FaSave, FaTimes } from 'react-icons/fa'
import { leadsAPI, usersAPI } from '../../services/api'
import { ROLE_STAGE_MAP, STAGES } from '../../utils/constants'
import { StageBadge, StatusBadge } from '../common'

const canReassignLead = (user, lead) => {
  if (!user || !lead) return false
  if (['Admin', 'Manager', 'Sales Manager', 'Service Manager'].includes(user.role)) return true
  return ROLE_STAGE_MAP[user.role] === lead.currentStage
}

const rolesForStage = (stage) => Object.entries(ROLE_STAGE_MAP)
  .filter(([, mappedStage]) => mappedStage === stage)
  .map(([role]) => role)

const uniqueById = (items) => Array.from(new Map(items.map((item) => [item._id, item])).values())
const formatDateTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export { canReassignLead }

export default function ReassignLeadModal({ lead, currentUser, onClose, onReassigned }) {
  const [targetStage, setTargetStage] = useState(lead?.currentStage || 'Lead')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetUsers, setTargetUsers] = useState([])
  const [note, setNote] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [saving, setSaving] = useState(false)

  const stageRoles = useMemo(() => rolesForStage(targetStage), [targetStage])
  const allowed = canReassignLead(currentUser, lead)

  useEffect(() => {
    if (!lead) return
    setTargetStage(lead.currentStage || 'Lead')
    setTargetUserId('')
    setNote('')
  }, [lead])

  useEffect(() => {
    let alive = true
    setTargetUsers([])
    setTargetUserId('')

    if (!stageRoles.length || targetStage === 'Completed') return undefined

    setLoadingUsers(true)
    Promise.all(stageRoles.map((role) => (
      usersAPI.getAssignable({ role, stage: targetStage })
        .then((response) => response.data.data || [])
        .catch(() => [])
    )))
      .then((results) => {
        if (!alive) return
        const users = uniqueById(results.flat())
        setTargetUsers(users)
        setTargetUserId(users[0]?._id || '')
      })
      .finally(() => {
        if (alive) setLoadingUsers(false)
      })

    return () => { alive = false }
  }, [stageRoles.join('|'), targetStage])

  const save = async () => {
    if (!allowed) {
      toast.error('You are not authorized to reassign this lead.')
      return
    }
    if (!targetStage) {
      toast.error('Select a dashboard.')
      return
    }

    setSaving(true)
    try {
      const response = await leadsAPI.reassign(lead._id, {
        stage: targetStage,
        userId: targetUserId || undefined,
        note,
      })
      toast.success('Lead reassigned successfully')
      onReassigned?.(response.data.data)
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign lead')
    } finally {
      setSaving(false)
    }
  }

  if (!lead) return null

  return (
    <div className="modal-backdrop reassign-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal-box reassign-modal">
        <div className="reassign-hero">
          <div>
            <div className="reassign-kicker"><FaExchangeAlt /> Lead Reassignment</div>
            <h2>{lead.name}</h2>
            <p>Move this lead to the correct dashboard and keep a full activity trail.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="reassign-summary-grid">
          <div>
            <span>Current Dashboard</span>
            <StageBadge stage={lead.currentStage} />
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status={lead.status} />
          </div>
          <div>
            <span>Assigned To</span>
            <strong>{lead.assignedTo?.name || '-'}</strong>
          </div>
          <div>
            <span>Lead ID</span>
            <strong>{lead.leadId || lead._id?.slice(-6)}</strong>
          </div>
        </div>

        <div className="reassign-section">
          <div className="reassign-section-title"><FaHistory /> Activity History</div>
          <div className="reassign-history-list">
            {(lead.history || []).slice().reverse().slice(0, 8).map((item, index) => (
              <div className="history-item" key={`${item.timestamp}-${index}`}>
                <div className="reassign-history-dot">{item.action === 'Reassigned' ? <FaExchangeAlt /> : index + 1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{item.stage} | {item.action}</div>
                  {item.action === 'Reassigned' && (
                    <div style={{ fontSize:12, color:'var(--muted)' }}>
                      {item.previousDashboard || item.previousStage || '-'} {'->'} {item.newDashboard || item.newStage || item.stage}
                      {item.reassignedToName ? ` | ${item.reassignedToName}` : ''}
                    </div>
                  )}
                  {item.performedByName && <div style={{ fontSize:12, color:'var(--muted)' }}>By: {item.performedByName}</div>}
                  {item.note && <div style={{ fontSize:11, color:'var(--dim)' }}>{item.note}</div>}
                </div>
                <div style={{ fontSize:11, color:'var(--dim)', whiteSpace:'nowrap' }}>{formatDateTime(item.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="reassign-section">
          <div className="reassign-section-title"><FaExchangeAlt /> Reassignment</div>
          {!allowed && <div className="reassign-warning">You do not have permission to reassign this lead.</div>}
          <div className="dashboard-form-grid">
            <div>
              <label className="form-label">New Dashboard / Stage</label>
              <select className="crm-input" value={targetStage} disabled={!allowed || saving} onChange={(event) => setTargetStage(event.target.value)}>
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Assign User</label>
              <select className="crm-input" value={targetUserId} disabled={!allowed || saving || loadingUsers || targetStage === 'Completed'} onChange={(event) => setTargetUserId(event.target.value)}>
                <option value="">{targetStage === 'Completed' ? 'No assignee for completed lead' : loadingUsers ? 'Loading users...' : 'Auto assign / select user'}</option>
                {targetUsers.map((user) => <option key={user._id} value={user._id}>{user.name} | {user.role}</option>)}
              </select>
            </div>
            <div className="full">
              <label className="form-label">Note / Reason</label>
              <textarea className="crm-input" rows={3} value={note} disabled={!allowed || saving} onChange={(event) => setNote(event.target.value)} placeholder="Why is this lead being reassigned?" />
            </div>
          </div>
        </div>

        <div className="dashboard-inline-actions reassign-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-secondary" disabled={!allowed || saving} onClick={() => setNote(note || `Reassigned from ${lead.currentStage} to ${targetStage}`)}>
            Reassign
          </button>
          <button type="button" className="btn btn-primary" disabled={!allowed || saving} onClick={save}>
            <FaSave /> {saving ? 'Saving...' : 'Save Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}
