import { useState } from 'react'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { canActOnStage, formatDate, STAGES, stageIndex } from '../../utils/constants'
import { getLeadViewSections } from '../../utils/leadDetails'
import { hasFileValue } from '../../utils/files'
import { FilePreview, StageBadge, StageProgress, StatusBadge } from '../common'

export default function LeadModal({
  lead,
  onClose,
  onUpdated,
  currentUser,
  showRegistrationPhotoUpload = false,
  showBankRemarkInput = false,
  showLoanApplicationInput = false,
  showInstallationInput = false,
  showNetMeteringInput = false,
  showSubsidyInput = false,
  showSubsidyReadingInput = false,
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
    panelPhoto: null,
    inverterBoxPhoto: null,
    earthingPhoto: null,
    columnConcretePhoto: null,
    panelNumber: lead.installationData?.panelNumber || '',
    inverterNumber: lead.installationData?.inverterNumber || '',
    brand: lead.installationData?.brand || '',
    customerShortVideo: null,
    meterNumber: lead.netMeteringData?.meterNumber || '',
    netMeteringPdf: null,
    subsidyPhoto: null,
    subsidyPhotoTwo: null,
    subsidyReadingPhoto: null,
  })

  const currentIndex = stageIndex(lead.currentStage)
  const { overview, salesExecutiveFields, stageSpecificFields, isSalesExecutiveLead, salesExecutiveData } = getLeadViewSections(lead)
  const blockedSalesExecutiveApproval = isSalesExecutiveLead && lead.currentStage === 'Lead' && currentUser?.role === 'Sales Executive'
  const canAct = canActOnStage(currentUser?.role, lead.currentStage) && !blockedSalesExecutiveApproval
  const canApprove = canAct && lead.status === 'active' && currentIndex < STAGES.length - 1
  const canAddBankRemark = showBankRemarkInput && lead.currentStage === 'Bank Approval'
  const canAddLoanApplication = showLoanApplicationInput && lead.currentStage === 'Loan Disbursement'
  const canAddRegistrationPhotos = showRegistrationPhotoUpload && lead.currentStage === 'Registration'
  const canAddInstallationData = showInstallationInput && lead.currentStage === 'Installation'
  const canAddNetMeteringData = showNetMeteringInput && lead.currentStage === 'Net Metering'
  const canAddSubsidyData = showSubsidyInput && lead.currentStage === 'Subsidy'
  const canAddSubsidyReadingData = showSubsidyReadingInput && lead.currentStage === 'Subsidy Reading'
  const displayedSalesExecutiveFields = canAddRegistrationPhotos
    ? salesExecutiveFields.filter(([label]) => !['Photo 1', 'Photo 2'].includes(label))
    : salesExecutiveFields
  const displayedStageSpecificFields = stageSpecificFields.filter(([label]) => {
    if (label === 'Bank Remark') return !canAddBankRemark
    if (label === 'Application ID') return showLoanApplicationInput && !canAddLoanApplication
    return true
  })
  const uploadedFileItems = [
    ['Photo 1', salesExecutiveData.photoOneFile || salesExecutiveData.photoOneName],
    ['Photo 2', salesExecutiveData.photoTwoFile || salesExecutiveData.photoTwoName],
    ['Document PDF', salesExecutiveData.documentPdfFile || salesExecutiveData.documentPdfName],
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

  const selectedStageFiles = {
    panelPhoto: stageForm.panelPhoto,
    inverterBoxPhoto: stageForm.inverterBoxPhoto,
    earthingPhoto: stageForm.earthingPhoto,
    columnConcretePhoto: stageForm.columnConcretePhoto,
    customerShortVideo: stageForm.customerShortVideo,
    netMeteringPdf: stageForm.netMeteringPdf,
    subsidyPhoto: stageForm.subsidyPhoto,
    subsidyPhotoTwo: stageForm.subsidyPhotoTwo,
    subsidyReadingPhoto: stageForm.subsidyReadingPhoto,
  }

  const buildApprovePayload = (stageData) => {
    const selectedFiles = Object.entries(selectedStageFiles).filter(([, file]) => file)
    if (!selectedFiles.length) {
      return {
        note: note || 'Approved',
        ...(Object.keys(stageData).length ? { stageData } : {}),
      }
    }

    const payload = new FormData()
    payload.append('note', note || 'Approved')
    if (Object.keys(stageData).length) payload.append('stageData', JSON.stringify(stageData))
    selectedFiles.forEach(([field, file]) => payload.append(field, file))
    return payload
  }

  const doApprove = async () => {
    if (canAddLoanApplication && !stageForm.applicationId.trim()) {
      toast.error('Application number is required.')
      return
    }
    if (canAddInstallationData) {
      if (!/^\d{16}$/.test(stageForm.panelNumber.trim())) {
        toast.error('Panel number must be exactly 16 digits.')
        return
      }
      if (!stageForm.inverterNumber.trim()) {
        toast.error('Inverter number is required.')
        return
      }
    }
    if (canAddNetMeteringData && !stageForm.meterNumber.trim()) {
      toast.error('Meter number is required.')
      return
    }

    setLoading(true)
    try {
      const stageData = {}
      if (canAddBankRemark) stageData.remark = stageForm.remark.trim()
      if (canAddLoanApplication) stageData.applicationId = stageForm.applicationId.trim()
      if (canAddInstallationData) {
        stageData.panelPhotoName = stageForm.panelPhoto?.name || lead.installationData?.panelPhotoName || ''
        stageData.inverterBoxPhotoName = stageForm.inverterBoxPhoto?.name || lead.installationData?.inverterBoxPhotoName || ''
        stageData.earthingPhotoName = stageForm.earthingPhoto?.name || lead.installationData?.earthingPhotoName || ''
        stageData.columnConcretePhotoName = stageForm.columnConcretePhoto?.name || lead.installationData?.columnConcretePhotoName || ''
        stageData.panelNumber = stageForm.panelNumber.trim()
        stageData.inverterNumber = stageForm.inverterNumber.trim()
        stageData.brand = stageForm.brand.trim()
        stageData.customerShortVideoName = stageForm.customerShortVideo?.name || lead.installationData?.customerShortVideoName || ''
      }
      if (canAddNetMeteringData) {
        stageData.meterNumber = stageForm.meterNumber.trim()
        stageData.pdfName = stageForm.netMeteringPdf?.name || lead.netMeteringData?.pdfName || ''
      }
      if (canAddSubsidyData) {
        stageData.photoName = stageForm.subsidyPhoto?.name || lead.subsidyData?.photoName || ''
        stageData.photoTwoName = stageForm.subsidyPhotoTwo?.name || lead.subsidyData?.photoTwoName || ''
      }
      if (canAddSubsidyReadingData) {
        stageData.photoName = stageForm.subsidyReadingPhoto?.name || lead.subsidyReadingData?.photoName || ''
      }

      await leadsAPI.approve(lead._id, buildApprovePayload(stageData))
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
      toast.error('Please select Photo 1 or Photo 2.')
      return
    }

    setLoading(true)
    try {
      const nextSalesExecutiveData = {
        ...salesExecutiveData,
        photoOneName: registrationPhotos.photoOne?.name || salesExecutiveData.photoOneName || '',
        photoTwoName: registrationPhotos.photoTwo?.name || salesExecutiveData.photoTwoName || '',
      }

      const payload = new FormData()
      payload.append('salesExecutiveData', JSON.stringify(nextSalesExecutiveData))
      payload.append('updateNote', `Registration photos updated: Photo 1 - ${nextSalesExecutiveData.photoOneName || 'Pending'}, Photo 2 - ${nextSalesExecutiveData.photoTwoName || 'Pending'}`)
      if (registrationPhotos.photoOne) payload.append('photoOne', registrationPhotos.photoOne)
      if (registrationPhotos.photoTwo) payload.append('photoTwo', registrationPhotos.photoTwo)

      await leadsAPI.update(lead._id, payload)
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

        {uploadedFileItems.length > 0 && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Uploaded Files</div>
            <div className="dashboard-mini-grid-2">
              {uploadedFileItems.map(([label, file]) => (
                <FilePreview key={label} file={file} label={label} compact />
              ))}
            </div>
          </div>
        )}

        {(lead.dispatchData?.items || []).length > 0 && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div className="dashboard-split-row" style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>Dispatch Material</div>
              <span className="badge badge-blue">{lead.dispatchData?.billNo || 'Dispatch bill'}</span>
            </div>
            <div className="dashboard-stack">
              {(lead.dispatchData.items || []).map((item, index) => (
                <div key={`${item.productId || item.productName}-${index}`} style={{ display:'grid', gridTemplateColumns:'1fr 110px 90px', gap:10, fontSize:12, padding:'7px 0', borderTop:'1px solid var(--border)' }}>
                  <span>{item.productName}<div style={{ color:'var(--muted)', fontSize:11 }}>{[item.category, item.brand, item.type, item.capacity].filter(Boolean).join(' | ')}</div></span>
                  <strong>{item.quantity} {item.unit || 'pcs'}</strong>
                  <span>Left {item.remainingQuantity ?? '-'}</span>
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
                <div style={{ marginTop:8 }}>
                  <FilePreview file={registrationPhotos.photoOne || salesExecutiveData.photoOneFile || salesExecutiveData.photoOneName} label="Photo 1" compact />
                  {!hasFileValue(registrationPhotos.photoOne || salesExecutiveData.photoOneFile || salesExecutiveData.photoOneName) && (
                    <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Photo 1 pending</div>
                  )}
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
                <div style={{ marginTop:8 }}>
                  <FilePreview file={registrationPhotos.photoTwo || salesExecutiveData.photoTwoFile || salesExecutiveData.photoTwoName} label="Photo 2" compact />
                  {!hasFileValue(registrationPhotos.photoTwo || salesExecutiveData.photoTwoFile || salesExecutiveData.photoTwoName) && (
                    <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Photo 2 pending</div>
                  )}
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

        {(canAddBankRemark || canAddLoanApplication || canAddInstallationData || canAddNetMeteringData || canAddSubsidyData || canAddSubsidyReadingData) && (
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
            {canAddInstallationData && (
              <div className="crm-card-sm" style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Installation Details</div>
                <div className="dashboard-form-grid">
                  <div>
                    <label className="form-label">Panel Pic</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, panelPhoto: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.panelPhoto || lead.installationData?.panelPhotoFile || lead.installationData?.panelPhotoName} label="Panel pic" compact />
                      {!hasFileValue(stageForm.panelPhoto || lead.installationData?.panelPhotoFile || lead.installationData?.panelPhotoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Panel pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Panel Number</label>
                    <input className="crm-input" inputMode="numeric" maxLength={16} value={stageForm.panelNumber} onChange={(e) => setStageForm((prev) => ({ ...prev, panelNumber: e.target.value.replace(/\D/g, '').slice(0, 16) }))} placeholder="16 digit panel number" />
                  </div>
                  <div>
                    <label className="form-label">Inverter Number</label>
                    <input className="crm-input" value={stageForm.inverterNumber} onChange={(e) => setStageForm((prev) => ({ ...prev, inverterNumber: e.target.value }))} placeholder="Unique inverter number" />
                  </div>
                  <div>
                    <label className="form-label">Brand</label>
                    <input className="crm-input" value={stageForm.brand} onChange={(e) => setStageForm((prev) => ({ ...prev, brand: e.target.value }))} placeholder="Inverter brand" />
                  </div>
                  <div>
                    <label className="form-label">Inverter AC+DC Box</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, inverterBoxPhoto: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.inverterBoxPhoto || lead.installationData?.inverterBoxPhotoFile || lead.installationData?.inverterBoxPhotoName} label="AC+DC box" compact />
                      {!hasFileValue(stageForm.inverterBoxPhoto || lead.installationData?.inverterBoxPhotoFile || lead.installationData?.inverterBoxPhotoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>AC+DC box pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Earthing Pic</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, earthingPhoto: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.earthingPhoto || lead.installationData?.earthingPhotoFile || lead.installationData?.earthingPhotoName} label="Earthing pic" compact />
                      {!hasFileValue(stageForm.earthingPhoto || lead.installationData?.earthingPhotoFile || lead.installationData?.earthingPhotoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Earthing pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Column Concrete</label>
                    <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, columnConcretePhoto: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.columnConcretePhoto || lead.installationData?.columnConcretePhotoFile || lead.installationData?.columnConcretePhotoName} label="Column concrete" compact />
                      {!hasFileValue(stageForm.columnConcretePhoto || lead.installationData?.columnConcretePhotoFile || lead.installationData?.columnConcretePhotoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Column concrete pic pending</div>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Short Video With Customer</label>
                    <input className="crm-input" type="file" accept="video/*" onChange={(e) => setStageForm((prev) => ({ ...prev, customerShortVideo: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.customerShortVideo || lead.installationData?.customerShortVideoFile || lead.installationData?.customerShortVideoName} label="Short video" compact />
                      {!hasFileValue(stageForm.customerShortVideo || lead.installationData?.customerShortVideoFile || lead.installationData?.customerShortVideoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Video pending</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canAddNetMeteringData && (
              <div className="crm-card-sm" style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Net Metering Details</div>
                <div className="dashboard-form-grid">
                  <div>
                    <label className="form-label">Meter Number</label>
                    <input className="crm-input" value={stageForm.meterNumber} onChange={(e) => setStageForm((prev) => ({ ...prev, meterNumber: e.target.value }))} placeholder="Unique meter number" />
                  </div>
                  <div>
                    <label className="form-label">Upload PDF</label>
                    <input className="crm-input" type="file" accept="application/pdf,.pdf" onChange={(e) => setStageForm((prev) => ({ ...prev, netMeteringPdf: e.target.files?.[0] || null }))} />
                    <div style={{ marginTop:8 }}>
                      <FilePreview file={stageForm.netMeteringPdf || lead.netMeteringData?.pdfFile || lead.netMeteringData?.pdfName} label="Net metering PDF" compact />
                      {!hasFileValue(stageForm.netMeteringPdf || lead.netMeteringData?.pdfFile || lead.netMeteringData?.pdfName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>PDF pending</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canAddSubsidyData && (
              <div className="crm-card-sm" style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Subsidy Details</div>
                <div>
                  <label className="form-label">Subsidy Photo</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, subsidyPhoto: e.target.files?.[0] || null }))} />
                  <div style={{ marginTop:8 }}>
                    <FilePreview file={stageForm.subsidyPhoto || lead.subsidyData?.photoFile || lead.subsidyData?.photoName} label="Subsidy photo" compact />
                    {!hasFileValue(stageForm.subsidyPhoto || lead.subsidyData?.photoFile || lead.subsidyData?.photoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Photo pending</div>}
                  </div>
                </div>
                <div style={{ marginTop:12 }}>
                  <label className="form-label">Subsidy Photo 2</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, subsidyPhotoTwo: e.target.files?.[0] || null }))} />
                  <div style={{ marginTop:8 }}>
                    <FilePreview file={stageForm.subsidyPhotoTwo || lead.subsidyData?.photoTwoFile || lead.subsidyData?.photoTwoName} label="Subsidy photo 2" compact />
                    {!hasFileValue(stageForm.subsidyPhotoTwo || lead.subsidyData?.photoTwoFile || lead.subsidyData?.photoTwoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Photo 2 pending</div>}
                  </div>
                </div>
              </div>
            )}
            {canAddSubsidyReadingData && (
              <div className="crm-card-sm" style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Subsidy Reading Details</div>
                <div>
                  <label className="form-label">Subsidy Reading Photo</label>
                  <input className="crm-input" type="file" accept="image/*" onChange={(e) => setStageForm((prev) => ({ ...prev, subsidyReadingPhoto: e.target.files?.[0] || null }))} />
                  <div style={{ marginTop:8 }}>
                    <FilePreview file={stageForm.subsidyReadingPhoto || lead.subsidyReadingData?.photoFile || lead.subsidyReadingData?.photoName} label="Subsidy reading photo" compact />
                    {!hasFileValue(stageForm.subsidyReadingPhoto || lead.subsidyReadingData?.photoFile || lead.subsidyReadingData?.photoName) && <div style={{ fontSize:12, color:'var(--muted)', wordBreak:'break-word' }}>Photo pending</div>}
                  </div>
                </div>
              </div>
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
