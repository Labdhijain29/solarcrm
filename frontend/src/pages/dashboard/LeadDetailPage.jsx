import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { StageProgress, StageBadge, StatusBadge, Spinner, PageHeader } from '../../components/common'
import { useAuthStore } from '../../store'
import { canActOnStage, STAGES, stageIndex, formatDate } from '../../utils/constants'
import { getLeadViewSections } from '../../utils/leadDetails'

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [stageForm, setStageForm] = useState({ remark: '', applicationId: '' })

  const fetch = () => leadsAPI.getOne(id).then((response) => {
    const nextLead = response.data.data
    setLead(nextLead)
    setStageForm({
      remark: nextLead.bankData?.remark || '',
      applicationId: nextLead.loanData?.applicationId || '',
    })
  }).catch(() => navigate('/dashboard/leads')).finally(() => setLoading(false))
  useEffect(fetch, [id])

  if (loading) return <Spinner size={48} />
  if (!lead) return null

  const ci = stageIndex(lead.currentStage)
  const { overview, salesExecutiveFields, stageSpecificFields, isSalesExecutiveLead } = getLeadViewSections(lead)
  const blockedSalesExecutiveApproval = isSalesExecutiveLead && lead.currentStage === 'Lead' && user?.role === 'Sales Executive'
  const canAct = canActOnStage(user?.role, lead.currentStage) && !blockedSalesExecutiveApproval
  const showBankRemarkField = lead.currentStage === 'Bank Approval'
  const showLoanApplicationField = lead.currentStage === 'Loan Disbursement'

  const doApprove = async () => {
    setActing(true)
    try {
      const stageData = {}
      if (showBankRemarkField) stageData.remark = stageForm.remark.trim()
      if (showLoanApplicationField) stageData.applicationId = stageForm.applicationId.trim()

      await leadsAPI.approve(id, {
        note: note || 'Approved',
        ...(Object.keys(stageData).length ? { stageData } : {}),
      })
      toast.success(`Moved to ${STAGES[ci + 1]}`)
      fetch()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed')
    } finally {
      setActing(false)
    }
  }

  const doReject = async () => {
    if (!window.confirm('Reject this lead?')) return
    setActing(true)
    try {
      await leadsAPI.reject(id, { note: note || 'Rejected' })
      toast.success('Lead rejected')
      fetch()
    } catch {
      toast.error('Failed')
    } finally {
      setActing(false)
    }
  }

  const doNote = async () => {
    if (!note.trim()) return
    try {
      await leadsAPI.addNote(id, note)
      toast.success('Note added')
      setNote('')
      fetch()
    } catch {
      toast.error('Failed')
    }
  }

  const fields = [
    ...overview,
    ['Created', formatDate(lead.createdAt)],
    ['Last Updated', formatDate(lead.updatedAt)],
  ]

  return (
    <div style={{ animation: 'fadeIn .4s ease', maxWidth: 900 }}>
      <PageHeader
        icon="SUN"
        title={lead.name}
        subtitle={<div style={{ display: 'flex', gap: 8, marginTop: 4 }}><StageBadge stage={lead.currentStage} /><StatusBadge status={lead.status} /></div>}
        action={<button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>Back</button>}
      />

      <div className="crm-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Pipeline Progress</div>
        <StageProgress lead={lead} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="crm-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Lead Details</div>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
            </div>
          ))}
        </div>

        <div>
          {salesExecutiveFields.length > 0 && (
            <div className="crm-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Sales Executive Form Details</div>
              {salesExecutiveFields.map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {stageSpecificFields.some(([, value]) => value !== '-') && (
            <div className="crm-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Stage Details</div>
              {stageSpecificFields.filter(([, value]) => value !== '-').map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {canAct && lead.status === 'active' && (
            <div className="crm-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Actions</div>
              {showBankRemarkField && (
                <input
                  className="crm-input"
                  style={{ marginBottom: 12 }}
                  placeholder="Enter bank remark"
                  value={stageForm.remark}
                  onChange={(event) => setStageForm((prev) => ({ ...prev, remark: event.target.value }))}
                />
              )}
              {showLoanApplicationField && (
                <input
                  className="crm-input"
                  style={{ marginBottom: 12 }}
                  placeholder="Enter unique application ID"
                  value={stageForm.applicationId}
                  onChange={(event) => setStageForm((prev) => ({ ...prev, applicationId: event.target.value }))}
                />
              )}
              <textarea className="crm-input" rows={2} placeholder="Add a note or reason..." value={note} onChange={(event) => setNote(event.target.value)} style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ci < STAGES.length - 1 && (
                  <button className="btn btn-success" style={{ flex: 1 }} disabled={acting} onClick={doApprove}>
                    Approve {'->'} {STAGES[ci + 1]}
                  </button>
                )}
                <button className="btn btn-danger" disabled={acting} onClick={doReject}>Reject</button>
                <button className="btn btn-ghost btn-sm" disabled={acting || !note.trim()} onClick={doNote}>Save Note</button>
              </div>
            </div>
          )}

          {blockedSalesExecutiveApproval && (
            <div className="crm-card" style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
              Sales executive lead pehle manager approve karega, uske baad hi registration stage me move hogi.
            </div>
          )}

          <div className="crm-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Activity History</div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(lead.history || []).map((item, index) => (
                <div key={index} className="history-item">
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: item.action === 'Approved' || item.action === 'Completed' ? 'rgba(16,185,129,.1)' : item.action === 'Rejected' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)' }}>
                    {item.action === 'Approved' || item.action === 'Completed' ? 'OK' : item.action === 'Rejected' ? 'NO' : '...'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{item.stage} | {item.action}</div>
                    {item.performedByName && <div style={{ fontSize: 11, color: 'var(--muted)' }}>By {item.performedByName}</div>}
                    {item.note && <div style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>{item.note}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{formatDate(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
