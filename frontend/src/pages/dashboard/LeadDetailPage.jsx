import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadsAPI, usersAPI } from '../../services/api'
import { FilePreview, StageProgress, StageBadge, StatusBadge, Spinner, PageHeader } from '../../components/common'
import { useAuthStore } from '../../store'
import { canActOnStage, STAGES, stageIndex, formatDate, ROLE_STAGE_MAP } from '../../utils/constants'
import { getLeadViewSections } from '../../utils/leadDetails'
import { hasFileValue } from '../../utils/files'

const isAssignableUser = (item, role) => (
  item.role === role &&
  item.isActive !== false &&
  item.approvalStatus !== 'rejected'
)

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [nextStageUsers, setNextStageUsers] = useState([])
  const [nextAssigneeId, setNextAssigneeId] = useState('')
  const [stageForm, setStageForm] = useState({
    remark: '',
    applicationId: '',
    panelPhoto: null,
    inverterBoxPhoto: null,
    earthingPhoto: null,
    columnConcretePhoto: null,
    panelNumber: '',
    inverterNumber: '',
    brand: '',
    customerShortVideo: null,
    meterNumber: '',
    netMeteringPdf: null,
    subsidyPhoto: null,
    subsidyPhotoTwo: null,
    subsidyReadingPhoto: null,
  })

  const fetch = () => leadsAPI.getOne(id).then((response) => {
    const nextLead = response.data.data
    setLead(nextLead)
    setStageForm({
      remark: nextLead.bankData?.remark || '',
      applicationId: nextLead.loanData?.applicationId || '',
      panelPhoto: null,
      inverterBoxPhoto: null,
      earthingPhoto: null,
      columnConcretePhoto: null,
      panelNumber: nextLead.installationData?.panelNumber || '',
      inverterNumber: nextLead.installationData?.inverterNumber || '',
      brand: nextLead.installationData?.brand || '',
      customerShortVideo: null,
      meterNumber: nextLead.netMeteringData?.meterNumber || '',
      netMeteringPdf: null,
      subsidyPhoto: null,
      subsidyPhotoTwo: null,
      subsidyReadingPhoto: null,
    })
  }).catch(() => navigate('/dashboard/leads')).finally(() => setLoading(false))
  useEffect(fetch, [id])

  const currentLeadStage = lead?.currentStage || ''
  const isSalesExecutiveLeadForAccess = Array.isArray(lead?.tags) && lead.tags.includes('sales-executive')
  const blockedSalesExecutiveApproval = isSalesExecutiveLeadForAccess && currentLeadStage === 'Lead' && user?.role === 'Sales Executive'
  const canAct = Boolean(lead) && canActOnStage(user?.role, currentLeadStage) && !blockedSalesExecutiveApproval
  const nextStage = STAGES[stageIndex(currentLeadStage) + 1] || ''
  const isSalesManagerHandoff = currentLeadStage === 'Lead'
    && (user?.role === 'Sales Manager' || lead?.assignedTo?.role === 'Sales Manager')
  const nextStageRole = isSalesManagerHandoff
    ? 'Manager'
    : Object.keys(ROLE_STAGE_MAP).find((role) => ROLE_STAGE_MAP[role] === nextStage) || ''
  const assignmentStage = isSalesManagerHandoff ? 'Lead' : nextStage
  const canApprove = canAct && lead?.status === 'active' && Boolean(nextStage)

  useEffect(() => {
    if (!canApprove || !nextStageRole) {
      setNextStageUsers([])
      setNextAssigneeId('')
      return
    }

    let alive = true
    const loadUsersFallback = () => {
      if (!['Admin', 'Manager'].includes(user?.role)) return Promise.resolve([])
      return usersAPI.getAll()
        .then((response) => (response.data.data || []).filter((item) => isAssignableUser(item, nextStageRole)))
        .catch(() => [])
    }

    usersAPI.getAssignable({ role: nextStageRole, stage: assignmentStage })
      .then(async (response) => {
        if (!alive) return
        const users = (response.data.data || []).filter((item) => isAssignableUser(item, nextStageRole))
        const resolvedUsers = users.length ? users : await loadUsersFallback()
        setNextStageUsers(resolvedUsers)
        setNextAssigneeId((prev) => (
          resolvedUsers.some((item) => item._id === prev) ? prev : resolvedUsers[0]?._id || ''
        ))
      })
      .catch(async () => {
        if (!alive) return
        const resolvedUsers = await loadUsersFallback()
        setNextStageUsers(resolvedUsers)
        setNextAssigneeId((prev) => (
          resolvedUsers.some((item) => item._id === prev) ? prev : resolvedUsers[0]?._id || ''
        ))
      })

    return () => { alive = false }
  }, [assignmentStage, canApprove, nextStageRole, user?.role])

  if (loading) return <Spinner size={48} />
  if (!lead) return null

  const ci = stageIndex(lead.currentStage)
  const { overview, salesExecutiveFields, stageSpecificFields } = getLeadViewSections(lead)
  const showBankRemarkField = lead.currentStage === 'Bank Approval'
  const showLoanApplicationField = lead.currentStage === 'Loan Disbursement'
  const showInstallationField = lead.currentStage === 'Installation'
  const showNetMeteringField = lead.currentStage === 'Net Metering'
  const showSubsidyField = lead.currentStage === 'Subsidy'
  const showSubsidyReadingField = lead.currentStage === 'Subsidy Reading'
  const uploadedFileItems = [
    ['Photo 1', lead.salesExecutiveData?.photoOneFile || lead.salesExecutiveData?.photoOneName],
    ['Photo 2', lead.salesExecutiveData?.photoTwoFile || lead.salesExecutiveData?.photoTwoName],
    ['Document PDF', lead.salesExecutiveData?.documentPdfFile || lead.salesExecutiveData?.documentPdfName],
    ['Panel Photo', lead.installationData?.panelPhotoFile || lead.installationData?.panelPhotoName],
    ['Inverter AC+DC Box', lead.installationData?.inverterBoxPhotoFile || lead.installationData?.inverterBoxPhotoName],
    ['Earthing Photo', lead.installationData?.earthingPhotoFile || lead.installationData?.earthingPhotoName],
    ['Column Concrete', lead.installationData?.columnConcretePhotoFile || lead.installationData?.columnConcretePhotoName],
    ['Customer Short Video', lead.installationData?.customerShortVideoFile || lead.installationData?.customerShortVideoName],
    ['Net Metering PDF', lead.netMeteringData?.pdfFile || lead.netMeteringData?.pdfName],
    ['Subsidy Photo', lead.subsidyData?.photoFile || lead.subsidyData?.photoName],
    ['Subsidy Photo 2', lead.subsidyData?.photoTwoFile || lead.subsidyData?.photoTwoName],
    ['Subsidy Reading Photo', lead.subsidyReadingData?.photoFile || lead.subsidyReadingData?.photoName],
  ].filter(([, file]) => hasFileValue(file))

  const buildApprovePayload = (stageData) => {
    const selectedFiles = Object.entries({
      panelPhoto: stageForm.panelPhoto,
      inverterBoxPhoto: stageForm.inverterBoxPhoto,
      earthingPhoto: stageForm.earthingPhoto,
      columnConcretePhoto: stageForm.columnConcretePhoto,
      customerShortVideo: stageForm.customerShortVideo,
      netMeteringPdf: stageForm.netMeteringPdf,
      subsidyPhoto: stageForm.subsidyPhoto,
      subsidyPhotoTwo: stageForm.subsidyPhotoTwo,
      subsidyReadingPhoto: stageForm.subsidyReadingPhoto,
    }).filter(([, file]) => file)

    if (!selectedFiles.length) {
      return {
        note: note || 'Approved',
        ...(nextAssigneeId ? { nextAssigneeId } : {}),
        ...(Object.keys(stageData).length ? { stageData } : {}),
      }
    }

    const payload = new FormData()
    payload.append('note', note || 'Approved')
    if (nextAssigneeId) payload.append('nextAssigneeId', nextAssigneeId)
    if (Object.keys(stageData).length) payload.append('stageData', JSON.stringify(stageData))
    selectedFiles.forEach(([field, file]) => payload.append(field, file))
    return payload
  }

  const doApprove = async () => {
    if (showInstallationField) {
      if (!/^\d{16}$/.test(stageForm.panelNumber.trim())) {
        toast.error('Panel number must be exactly 16 digits.')
        return
      }
      if (!stageForm.inverterNumber.trim()) {
        toast.error('Inverter number is required.')
        return
      }
    }
    if (showNetMeteringField && !stageForm.meterNumber.trim()) {
      toast.error('Meter number is required.')
      return
    }
    if (nextStageRole && nextStageUsers.length > 0 && !nextAssigneeId) {
      toast.error(`Please select ${nextStageRole}.`)
      return
    }

    setActing(true)
    try {
      const stageData = {}
      if (showBankRemarkField) stageData.remark = stageForm.remark.trim()
      if (showLoanApplicationField) stageData.applicationId = stageForm.applicationId.trim()
      if (showInstallationField) {
        stageData.panelPhotoName = stageForm.panelPhoto?.name || lead.installationData?.panelPhotoName || ''
        stageData.inverterBoxPhotoName = stageForm.inverterBoxPhoto?.name || lead.installationData?.inverterBoxPhotoName || ''
        stageData.earthingPhotoName = stageForm.earthingPhoto?.name || lead.installationData?.earthingPhotoName || ''
        stageData.columnConcretePhotoName = stageForm.columnConcretePhoto?.name || lead.installationData?.columnConcretePhotoName || ''
        stageData.panelNumber = stageForm.panelNumber.trim()
        stageData.inverterNumber = stageForm.inverterNumber.trim()
        stageData.brand = stageForm.brand.trim()
        stageData.customerShortVideoName = stageForm.customerShortVideo?.name || lead.installationData?.customerShortVideoName || ''
      }
      if (showNetMeteringField) {
        stageData.meterNumber = stageForm.meterNumber.trim()
        stageData.pdfName = stageForm.netMeteringPdf?.name || lead.netMeteringData?.pdfName || ''
      }
      if (showSubsidyField) {
        stageData.photoName = stageForm.subsidyPhoto?.name || lead.subsidyData?.photoName || ''
        stageData.photoTwoName = stageForm.subsidyPhotoTwo?.name || lead.subsidyData?.photoTwoName || ''
      }
      if (showSubsidyReadingField) {
        stageData.photoName = stageForm.subsidyReadingPhoto?.name || lead.subsidyReadingData?.photoName || ''
      }

      await leadsAPI.approve(id, buildApprovePayload(stageData))
      toast.success(isSalesManagerHandoff ? 'Sent to Manager' : `Moved to ${STAGES[ci + 1]}`)
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
    <div className="dashboard-page" style={{ maxWidth: 900 }}>
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

      <div className="dashboard-grid-two" style={{ marginBottom: 16 }}>
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

          {uploadedFileItems.length > 0 && (
            <div className="crm-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Uploaded Files</div>
              <div className="dashboard-stack">
                {uploadedFileItems.map(([label, file]) => (
                  <FilePreview key={label} file={file} label={label} compact />
                ))}
              </div>
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
              {showInstallationField && (
                <div className="dashboard-form-grid" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="form-label">Panel Pic</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, panelPhoto: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.panelPhoto || lead.installationData?.panelPhotoFile || lead.installationData?.panelPhotoName} label="Panel pic" compact />
                      {!hasFileValue(stageForm.panelPhoto || lead.installationData?.panelPhotoFile || lead.installationData?.panelPhotoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Panel pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Panel Number</label>
                    <input className="crm-input" inputMode="numeric" maxLength={16} value={stageForm.panelNumber} onChange={(event) => setStageForm((prev) => ({ ...prev, panelNumber: event.target.value.replace(/\D/g, '').slice(0, 16) }))} placeholder="16 digit panel number" />
                  </div>
                  <div>
                    <label className="form-label">Inverter Number</label>
                    <input className="crm-input" value={stageForm.inverterNumber} onChange={(event) => setStageForm((prev) => ({ ...prev, inverterNumber: event.target.value }))} placeholder="Unique inverter number" />
                  </div>
                  <div>
                    <label className="form-label">Brand</label>
                    <input className="crm-input" value={stageForm.brand} onChange={(event) => setStageForm((prev) => ({ ...prev, brand: event.target.value }))} placeholder="Inverter brand" />
                  </div>
                  <div>
                    <label className="form-label">Inverter AC+DC Box</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, inverterBoxPhoto: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.inverterBoxPhoto || lead.installationData?.inverterBoxPhotoFile || lead.installationData?.inverterBoxPhotoName} label="AC+DC box" compact />
                      {!hasFileValue(stageForm.inverterBoxPhoto || lead.installationData?.inverterBoxPhotoFile || lead.installationData?.inverterBoxPhotoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>AC+DC box pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Earthing Pic</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, earthingPhoto: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.earthingPhoto || lead.installationData?.earthingPhotoFile || lead.installationData?.earthingPhotoName} label="Earthing pic" compact />
                      {!hasFileValue(stageForm.earthingPhoto || lead.installationData?.earthingPhotoFile || lead.installationData?.earthingPhotoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Earthing pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Column Concrete</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, columnConcretePhoto: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.columnConcretePhoto || lead.installationData?.columnConcretePhotoFile || lead.installationData?.columnConcretePhotoName} label="Column concrete" compact />
                      {!hasFileValue(stageForm.columnConcretePhoto || lead.installationData?.columnConcretePhotoFile || lead.installationData?.columnConcretePhotoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Column concrete pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Short Video With Customer</label>
                    <input className="crm-input" type="file" accept="video/*" onChange={(event) => setStageForm((prev) => ({ ...prev, customerShortVideo: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.customerShortVideo || lead.installationData?.customerShortVideoFile || lead.installationData?.customerShortVideoName} label="Short video" compact />
                      {!hasFileValue(stageForm.customerShortVideo || lead.installationData?.customerShortVideoFile || lead.installationData?.customerShortVideoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Video pending</div>}
                    </div>
                  </div>
                </div>
              )}
              {showNetMeteringField && (
                <div className="dashboard-form-grid" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="form-label">Meter Number</label>
                    <input className="crm-input" value={stageForm.meterNumber} onChange={(event) => setStageForm((prev) => ({ ...prev, meterNumber: event.target.value }))} placeholder="Unique meter number" />
                  </div>
                  <div>
                    <label className="form-label">Upload PDF</label>
                    <input className="crm-input" type="file" accept="application/pdf,.pdf" onChange={(event) => setStageForm((prev) => ({ ...prev, netMeteringPdf: event.target.files?.[0] || null }))} />
                    <div style={{ marginTop: 8 }}>
                      <FilePreview file={stageForm.netMeteringPdf || lead.netMeteringData?.pdfFile || lead.netMeteringData?.pdfName} label="Net metering PDF" compact />
                      {!hasFileValue(stageForm.netMeteringPdf || lead.netMeteringData?.pdfFile || lead.netMeteringData?.pdfName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>PDF pending</div>}
                    </div>
                  </div>
                </div>
              )}
              {showSubsidyField && (
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">Subsidy Photo</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, subsidyPhoto: event.target.files?.[0] || null }))} />
                  <div style={{ marginTop: 8 }}>
                    <FilePreview file={stageForm.subsidyPhoto || lead.subsidyData?.photoFile || lead.subsidyData?.photoName} label="Subsidy photo" compact />
                    {!hasFileValue(stageForm.subsidyPhoto || lead.subsidyData?.photoFile || lead.subsidyData?.photoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Photo pending</div>}
                  </div>
                  <label className="form-label" style={{ marginTop: 12 }}>Subsidy Photo 2</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, subsidyPhotoTwo: event.target.files?.[0] || null }))} />
                  <div style={{ marginTop: 8 }}>
                    <FilePreview file={stageForm.subsidyPhotoTwo || lead.subsidyData?.photoTwoFile || lead.subsidyData?.photoTwoName} label="Subsidy photo 2" compact />
                    {!hasFileValue(stageForm.subsidyPhotoTwo || lead.subsidyData?.photoTwoFile || lead.subsidyData?.photoTwoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Photo 2 pending</div>}
                  </div>
                </div>
              )}
              {showSubsidyReadingField && (
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">Subsidy Reading Photo</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(event) => setStageForm((prev) => ({ ...prev, subsidyReadingPhoto: event.target.files?.[0] || null }))} />
                  <div style={{ marginTop: 8 }}>
                    <FilePreview file={stageForm.subsidyReadingPhoto || lead.subsidyReadingData?.photoFile || lead.subsidyReadingData?.photoName} label="Subsidy reading photo" compact />
                    {!hasFileValue(stageForm.subsidyReadingPhoto || lead.subsidyReadingData?.photoFile || lead.subsidyReadingData?.photoName) && <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>Photo pending</div>}
                  </div>
                </div>
              )}
              <textarea className="crm-input" rows={2} placeholder="Add a note or reason..." value={note} onChange={(event) => setNote(event.target.value)} style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ci < STAGES.length - 1 && (
                  <button className="btn btn-success" style={{ flex: 1 }} disabled={acting} onClick={doApprove}>
                    Approve {'->'} {isSalesManagerHandoff ? 'Manager' : STAGES[ci + 1]}
                  </button>
                )}
                <button className="btn btn-danger" disabled={acting} onClick={doReject}>Reject</button>
                {nextStageRole && (
                  <select
                    className="crm-input"
                    value={nextAssigneeId}
                    disabled={acting || nextStageUsers.length === 0}
                    onChange={(event) => setNextAssigneeId(event.target.value)}
                    aria-label={`Assign lead to ${nextStageRole}`}
                    title={`Assign to ${nextStageRole}`}
                    style={{ width: 210, height: 38, fontSize: 12 }}
                  >
                    <option value="">{nextStageUsers.length ? `Assign to ${nextStageRole}` : `No ${nextStageRole} users`}</option>
                    {nextStageUsers.map((item) => (
                      <option key={item._id} value={item._id}>{item.name}</option>
                    ))}
                  </select>
                )}
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
