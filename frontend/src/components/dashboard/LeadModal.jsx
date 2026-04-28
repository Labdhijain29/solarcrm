import { useState } from 'react'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { canActOnStage, formatDate, STAGES, stageIndex } from '../../utils/constants'
import { getLeadViewSections } from '../../utils/leadDetails'
import { StageBadge, StageProgress, StatusBadge } from '../common'

export default function LeadModal({
  lead,
  onClose,
  onUpdated,
  currentUser,
  showRegistrationPhotoUpload = false,
  showBankRemarkInput = false,
  showLoanApplicationInput = false,
}) {
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [registrationPhotos, setRegistrationPhotos] = useState({
    photoOne: null,
    photoTwo: null,
  })
  const [stageForm, setStageForm] = useState({
    remark: lead.bankData?.remark || '',
    applicationId: lead.loanData?.applicationId || '',
  })

  const currentIndex = stageIndex(lead.currentStage)
  const { overview, salesExecutiveFields, stageSpecificFields, isSalesExecutiveLead, salesExecutiveData } = getLeadViewSections(lead)
  const blockedSalesExecutiveApproval = isSalesExecutiveLead && lead.currentStage === 'Lead' && currentUser?.role === 'Sales Executive'
  const canAct = canActOnStage(currentUser?.role, lead.currentStage) && !blockedSalesExecutiveApproval
  const canApprove = canAct && lead.status === 'active' && currentIndex < STAGES.length - 1
  const canAddBankRemark = showBankRemarkInput && lead.currentStage === 'Bank Approval'
  const canAddLoanApplication = showLoanApplicationInput && lead.currentStage === 'Loan Disbursement'
  const canAddRegistrationPhotos = showRegistrationPhotoUpload && lead.currentStage === 'Registration'
  const displayedSalesExecutiveFields = canAddRegistrationPhotos
    ? salesExecutiveFields.filter(([label]) => !['Photo 1', 'Photo 2'].includes(label))
    : salesExecutiveFields
  const displayedStageSpecificFields = stageSpecificFields.filter(([label]) => {
    if (label === 'Bank Remark') return !canAddBankRemark
    if (label === 'Application ID') return showLoanApplicationInput && !canAddLoanApplication
    return true
  })

  const doApprove = async () => {
    if (canAddLoanApplication && !stageForm.applicationId.trim()) {
      toast.error('Application no. required hai')
      return
    }

    setLoading(true)
    try {
      const stageData = {}
      if (canAddBankRemark) stageData.remark = stageForm.remark.trim()
      if (canAddLoanApplication) stageData.applicationId = stageForm.applicationId.trim()

      await leadsAPI.approve(lead._id, {
        note: note || 'Approved',
        ...(Object.keys(stageData).length ? { stageData } : {}),
      })
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

  const doSaveRegistrationPhotos = async () => {
    if (!registrationPhotos.photoOne && !registrationPhotos.photoTwo) {
      toast.error('Photo 1 ya Photo 2 select karein')
      return
    }

    setLoading(true)
    try {
      const nextSalesExecutiveData = {
        ...salesExecutiveData,
        photoOneName: registrationPhotos.photoOne?.name || salesExecutiveData.photoOneName || '',
        photoTwoName: registrationPhotos.photoTwo?.name || salesExecutiveData.photoTwoName || '',
      }

      await leadsAPI.update(lead._id, {
        salesExecutiveData: nextSalesExecutiveData,
        updateNote: `Registration photos updated: Photo 1 - ${nextSalesExecutiveData.photoOneName || 'Pending'}, Photo 2 - ${nextSalesExecutiveData.photoTwoName || 'Pending'}`,
      })
      toast.success('Registration photos saved')
      setRegistrationPhotos({ photoOne: null, photoTwo: null })
      onUpdated?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save photos')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    ...overview,
    ['Created', formatDate(lead.createdAt)],
    ['Last Updated', formatDate(lead.updatedAt)],
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

        {displayedSalesExecutiveFields.length > 0 && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Sales Executive Form Details</div>
            <div className="dashboard-mini-grid-2">
              {displayedSalesExecutiveFields.map(([label, value]) => (
                <div key={label} className="crm-card-sm" style={{ padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-word' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {displayedStageSpecificFields.some(([, value]) => value !== '-') && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Stage Details</div>
            <div className="dashboard-mini-grid-2">
              {displayedStageSpecificFields.filter(([, value]) => value !== '-').map(([label, value]) => (
                <div key={label} className="crm-card-sm" style={{ padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-word' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canAddRegistrationPhotos && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Registration Photos</div>
            <div className="dashboard-mini-grid-2" style={{ marginBottom:12 }}>
              <div>
                <label className="form-label">Photo 1</label>
                <input
                  className="crm-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRegistrationPhotos((prev) => ({ ...prev, photoOne: e.target.files?.[0] || null }))}
                />
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, wordBreak:'break-word' }}>
                  {registrationPhotos.photoOne?.name || salesExecutiveData.photoOneName || 'Photo 1 pending'}
                </div>
              </div>
              <div>
                <label className="form-label">Photo 2</label>
                <input
                  className="crm-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRegistrationPhotos((prev) => ({ ...prev, photoTwo: e.target.files?.[0] || null }))}
                />
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, wordBreak:'break-word' }}>
                  {registrationPhotos.photoTwo?.name || salesExecutiveData.photoTwoName || 'Photo 2 pending'}
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={loading} onClick={doSaveRegistrationPhotos}>
              Save Photos
            </button>
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

        {(canAddBankRemark || canAddLoanApplication) && (
          <div style={{ marginBottom:12 }}>
            {canAddBankRemark && (
              <input
                className="crm-input"
                style={{ marginBottom:12 }}
                placeholder="Enter bank remark"
                value={stageForm.remark}
                onChange={(e) => setStageForm((prev) => ({ ...prev, remark: e.target.value }))}
              />
            )}
            {canAddLoanApplication && (
              <input
                className="crm-input"
                style={{ marginBottom:12 }}
                placeholder="Enter unique application no."
                value={stageForm.applicationId}
                onChange={(e) => setStageForm((prev) => ({ ...prev, applicationId: e.target.value }))}
              />
            )}
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

        {blockedSalesExecutiveApproval && (
          <div style={{ marginTop:12, fontSize:12, color:'var(--muted)' }}>
            Ye sales executive lead pehle manager approve karega, uske baad hi registration stage me jayegi.
          </div>
        )}
      </div>
    </div>
  )
}
