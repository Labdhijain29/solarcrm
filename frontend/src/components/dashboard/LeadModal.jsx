import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { leadsAPI, usersAPI } from '../../services/api'
import { canActOnStage, formatDate, getCitiesForState, ROLE_STAGE_MAP, SOURCES, STAGES, STATE_OPTIONS, stageIndex } from '../../utils/constants'
import { getLeadViewSections } from '../../utils/leadDetails'
import { hasFileValue } from '../../utils/files'
import { ALL_BRAND_OPTIONS } from '../../pages/dashboard/inventoryStructure'
import { FilePreview, SearchableSelect, StageBadge, StageProgress, StatusBadge } from '../common'

const IVRS_REGEX = /^[A-Za-z0-9]{10}$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const PINCODE_REGEX = /^\d{6}$/
const CAPACITY_OPTIONS = Array.from({ length: 50 }, (_, index) => `${index + 1}kW`)
const MODULE_PANEL_COUNT = 6
const EDITABLE_PRE_APPROVAL_ROLES = ['Admin', 'Manager', 'Sales Executive', 'Sales Manager']
const CAPITALIZED_FIELDS = new Set(['name', 'state', 'city', 'address', 'branch', 'brand', 'other', 'generatedThrough'])
const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)
const isAssignableUser = (user, role) => (
  user.role === role &&
  user.isActive !== false &&
  user.approvalStatus !== 'rejected'
)

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
  startEditing = false,
}) {
  const [loading, setLoading] = useState(false)
  const [nextStageUsers, setNextStageUsers] = useState([])
  const [nextAssigneeId, setNextAssigneeId] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [sameStageUsers, setSameStageUsers] = useState([])
  const [reassignUserId, setReassignUserId] = useState('')
  const [showReassign, setShowReassign] = useState(false)
  const [registrationPhotos, setRegistrationPhotos] = useState({
    photoOne: null,
    photoTwo: null,
  })
  const [isEditing, setIsEditing] = useState(startEditing)
  const [editFiles, setEditFiles] = useState({
    photoOne: null,
    photoTwo: null,
    documentPdf: null,
    aadharCard: null,
    panCard: null,
    bankStatement: null,
  })
  const [editForm, setEditForm] = useState({
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    state: lead.state || lead.salesExecutiveData?.state || '',
    city: lead.city || lead.salesExecutiveData?.city || '',
    address: lead.address || lead.salesExecutiveData?.addressdu || '',
    pincode: lead.pincode || lead.salesExecutiveData?.pincode || '',
    branch: lead.branch || lead.salesExecutiveData?.branch || '',
    ivrsNo: lead.ivrsNo || '',
    source: lead.source || 'Other',
    generatedThrough: lead.generatedThrough || '',
    capacity: lead.capacity || '',
    roofType: lead.roofType || 'Concrete',
    monthlyBill: lead.monthlyBill || '',
    monthlyUnit: lead.salesExecutiveData?.monthlyUnit || '',
    dealNo: lead.salesExecutiveData?.dealNo || '',
    brand: lead.salesExecutiveData?.brand || '',
    panCardNo: lead.salesExecutiveData?.panCardNo || '',
    aadharNo: lead.salesExecutiveData?.aadharNo || '',
    accountNo: lead.salesExecutiveData?.accountNo || '',
    ifscCode: lead.salesExecutiveData?.ifscCode || '',
    other: lead.salesExecutiveData?.other || '',
  })
  const [stageForm, setStageForm] = useState({
    remark: lead.bankData?.remark || '',
    applicationId: lead.loanData?.applicationId || '',
    panelPhoto: null,
    inverterBoxPhoto: null,
    earthingPhoto: null,
    columnConcretePhoto: null,
    panelNumber: lead.installationData?.panelNumber || '',
    modulePanelNumbers: Array.from({ length: MODULE_PANEL_COUNT }, (_, index) => lead.installationData?.modulePanelNumbers?.[index] || ''),
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
  const canReassign = canAct && lead.status === 'active'
  const nextStage = STAGES[currentIndex + 1] || ''
  const previousStage = currentIndex > 0 ? STAGES[currentIndex - 1] : ''
  const previousStageRoles = useMemo(() => (
    Object.keys(ROLE_STAGE_MAP).filter((role) => ROLE_STAGE_MAP[role] === previousStage)
  ), [previousStage])
  const isSalesManagerHandoff = lead.currentStage === 'Lead'
    && (currentUser?.role === 'Sales Manager' || lead.assignedTo?.role === 'Sales Manager')
  const nextStageRole = useMemo(() => {
    if (isSalesManagerHandoff) return 'Manager'
    return Object.keys(ROLE_STAGE_MAP).find((role) => ROLE_STAGE_MAP[role] === nextStage) || ''
  }, [isSalesManagerHandoff, nextStage])
  const assignmentStage = isSalesManagerHandoff ? 'Lead' : nextStage
  const canEditBeforeApproval = lead.status === 'active' && (
    (lead.currentStage === 'Lead' && EDITABLE_PRE_APPROVAL_ROLES.includes(currentUser?.role)) ||
    (lead.currentStage === 'Registration' && ['Admin', 'Registration Executive'].includes(currentUser?.role))
  )
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
    ['Aadhar Card', salesExecutiveData.aadharCardFile || salesExecutiveData.aadharCardName],
    ['PAN Card', salesExecutiveData.panCardFile || salesExecutiveData.panCardName],
    ['Bank Statement', salesExecutiveData.bankStatementFile || salesExecutiveData.bankStatementName],
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

  useEffect(() => {
    if (!canApprove || !nextStageRole) {
      setNextStageUsers([])
      setNextAssigneeId('')
      return
    }

    let alive = true
    const loadUsersFallback = () => {
      if (!['Admin', 'Manager'].includes(currentUser?.role)) return Promise.resolve([])
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
  }, [assignmentStage, canApprove, currentUser?.role, nextStageRole])

  useEffect(() => {
    if (!canReassign || !previousStage || previousStageRoles.length === 0) {
      setSameStageUsers([])
      setReassignUserId('')
      return
    }

    let alive = true
    const loadPreviousStageUsers = async () => {
      const results = await Promise.all(previousStageRoles.map((role) => (
        usersAPI.getAssignable({ role, stage: previousStage })
          .then((response) => response.data.data || [])
          .catch(() => [])
      )))
      if (!alive) return
      const users = Array.from(new Map(results.flat().map((item) => [item._id, item])).values())
        .filter((item) => isAssignableUser(item, item.role))
      setSameStageUsers(users)
      setReassignUserId((prev) => (
        users.some((item) => item._id === prev) ? prev : users[0]?._id || ''
      ))
    }

    loadPreviousStageUsers()
    return () => { alive = false }
  }, [canReassign, previousStage, previousStageRoles])

  const buildApprovePayload = (stageData) => {
    const selectedFiles = Object.entries(selectedStageFiles).filter(([, file]) => file)
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
    if (canAddLoanApplication && !stageForm.applicationId.trim()) {
      toast.error('Application number is required.')
      return
    }
    if (canAddInstallationData) {
      if (!stageForm.panelNumber.trim()) {
        toast.error('Panel number is required.')
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
    if (nextStageRole && nextStageUsers.length > 0 && !nextAssigneeId) {
      toast.error(`Please select ${nextStageRole}.`)
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
        stageData.modulePanelNumbers = stageForm.modulePanelNumbers.map((item) => item.trim())
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
      toast.success(isSalesManagerHandoff ? 'Sent to Manager' : `Moved to ${STAGES[currentIndex + 1]}`)
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

  const doReassign = async () => {
    if (!reassignUserId) {
      toast.error('Please select a user to reassign.')
      return
    }
    setLoading(true)
    try {
      await leadsAPI.transfer(lead._id, {
        userId: reassignUserId,
        note: note || `Lead reassigned back to ${previousStage || 'previous stage'}`,
      })
      toast.success('Lead reassigned')
      setShowReassign(false)
      onUpdated?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign lead')
    } finally {
      setLoading(false)
    }
  }

  const updateEditField = (event) => {
    const { name, files } = event.target
    if (files) {
      setEditFiles((prev) => ({ ...prev, [name]: files?.[0] || null }))
      return
    }

    let { value } = event.target
    if (name === 'phone') value = normalizePhone(value)
    if (name === 'pincode') value = String(value || '').replace(/\D/g, '').slice(0, 6)
    if (name === 'ivrsNo') value = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10)
    if (name === 'aadharNo') value = String(value || '').replace(/\D/g, '').slice(0, 12)
    if (name === 'ifscCode') value = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11)
    if (name === 'monthlyBill' || name === 'monthlyUnit') value = String(value || '').replace(/[^\d.]/g, '')
    if (CAPITALIZED_FIELDS.has(name)) value = capitalizeFirstLetter(value)

    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const setEditField = (name, value) => {
    setEditForm((prev) => {
      if (name === 'state') return { ...prev, state: value, city: '' }
      return { ...prev, [name]: value }
    })
  }

  const doSavePreApprovalEdit = async () => {
    if (!editForm.name.trim()) return toast.error('Customer name is required.')
    if (!PHONE_REGEX.test(editForm.phone)) return toast.error('Contact number must be a valid 10-digit mobile number.')
    if (!editForm.branch.trim()) return toast.error('Branch is required.')
    if (editForm.pincode && !PINCODE_REGEX.test(editForm.pincode)) return toast.error('Pincode must be 6 digits.')
    if (editForm.ivrsNo && !IVRS_REGEX.test(editForm.ivrsNo)) return toast.error('IVRS number must be 10 letters or digits.')

    const nextSalesExecutiveData = {
      ...salesExecutiveData,
      contact: editForm.phone,
      state: editForm.state.trim(),
      city: editForm.city.trim(),
      addressdu: editForm.address.trim(),
      pincode: editForm.pincode,
      branch: editForm.branch.trim(),
      dealNo: editForm.dealNo.trim(),
      brand: editForm.brand.trim(),
      monthlyUnit: editForm.monthlyUnit,
      panCardNo: editForm.panCardNo.trim(),
      aadharNo: editForm.aadharNo.trim(),
      accountNo: editForm.accountNo.trim(),
      ifscCode: editForm.ifscCode.trim().toUpperCase(),
      other: editForm.other.trim(),
      photoOneName: editFiles.photoOne?.name || salesExecutiveData.photoOneName || '',
      photoTwoName: editFiles.photoTwo?.name || salesExecutiveData.photoTwoName || '',
      documentPdfName: editFiles.documentPdf?.name || salesExecutiveData.documentPdfName || '',
      aadharCardName: editFiles.aadharCard?.name || salesExecutiveData.aadharCardName || '',
      panCardName: editFiles.panCard?.name || salesExecutiveData.panCardName || '',
      bankStatementName: editFiles.bankStatement?.name || salesExecutiveData.bankStatementName || '',
    }

    const payload = new FormData()
    payload.append('name', editForm.name.trim())
    payload.append('phone', editForm.phone)
    payload.append('email', editForm.email.trim().toLowerCase())
    payload.append('state', editForm.state.trim())
    payload.append('city', editForm.city.trim())
    payload.append('address', editForm.address.trim())
    payload.append('pincode', editForm.pincode)
    payload.append('branch', editForm.branch.trim())
    payload.append('ivrsNo', editForm.ivrsNo)
    payload.append('source', editForm.source || 'Other')
    payload.append('generatedThrough', editForm.generatedThrough.trim())
    payload.append('capacity', editForm.capacity.trim() || '3kW')
    payload.append('roofType', editForm.roofType)
    payload.append('monthlyBill', editForm.monthlyBill || 0)
    payload.append('salesExecutiveData', JSON.stringify(nextSalesExecutiveData))
    payload.append('updateNote', 'Pre-approval registration details edited')
    if (editFiles.photoOne) payload.append('photoOne', editFiles.photoOne)
    if (editFiles.photoTwo) payload.append('photoTwo', editFiles.photoTwo)
    if (editFiles.documentPdf) payload.append('documentPdf', editFiles.documentPdf)
    if (editFiles.aadharCard) payload.append('aadharCard', editFiles.aadharCard)
    if (editFiles.panCard) payload.append('panCard', editFiles.panCard)
    if (editFiles.bankStatement) payload.append('bankStatement', editFiles.bankStatement)

    setLoading(true)
    try {
      await leadsAPI.update(lead._id, payload)
      toast.success('Registration details updated')
      setIsEditing(false)
      setEditFiles({ photoOne: null, photoTwo: null, documentPdf: null, aadharCard: null, panCard: null, bankStatement: null })
      onUpdated?.()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update lead')
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
      <div className="modal-box lead-view-modal">
        <div className="dashboard-split-row" style={{ marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>{lead.name}</h2>
            <div className="dashboard-inline-actions" style={{ marginTop:6 }}>
              <StageBadge stage={lead.currentStage} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
          {canEditBeforeApproval && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={loading}
              onClick={() => setIsEditing((prev) => !prev)}
            >
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--dim)', cursor:'pointer' }}>x</button>
        </div>

        {isEditing && canEditBeforeApproval && (
          <div className="crm-card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Edit Registration Before Approval</div>
            <div className="dashboard-form-grid">
              <div>
                <label className="form-label">Customer Name</label>
                <input className="crm-input" name="name" value={editForm.name} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Contact</label>
                <input className="crm-input" name="phone" value={editForm.phone} onChange={updateEditField} maxLength={10} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="crm-input" type="email" name="email" value={editForm.email} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">State</label>
                <SearchableSelect
                  name="edit-state"
                  value={editForm.state}
                  onChange={(value) => setEditField('state', value)}
                  options={toOptions(STATE_OPTIONS)}
                  placeholder="Select state..."
                  searchPlaceholder="Search state..."
                />
              </div>
              <div>
                <label className="form-label">City</label>
                <SearchableSelect
                  name="edit-city"
                  value={editForm.city}
                  onChange={(value) => setEditField('city', value)}
                  options={toOptions(getCitiesForState(editForm.state))}
                  placeholder={editForm.state ? 'Select city...' : 'Select state first'}
                  searchPlaceholder="Search city..."
                  noOptionsText={editForm.state ? 'No cities found' : 'Select state first'}
                  disabled={!editForm.state}
                />
              </div>
              <div>
                <label className="form-label">Pincode</label>
                <input className="crm-input" name="pincode" value={editForm.pincode} onChange={updateEditField} maxLength={6} />
              </div>
              <div className="full">
                <label className="form-label">Address</label>
                <textarea className="crm-input" name="address" value={editForm.address} onChange={updateEditField} rows={2} />
              </div>
              <div>
                <label className="form-label">Deal No.</label>
                <input className="crm-input" name="dealNo" value={editForm.dealNo} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Branch</label>
                <input className="crm-input" name="branch" value={editForm.branch} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Brand</label>
                <SearchableSelect
                  name="edit-brand"
                  value={editForm.brand}
                  onChange={(value) => setEditField('brand', value)}
                  options={toOptions(ALL_BRAND_OPTIONS)}
                  placeholder="Select brand..."
                  searchPlaceholder="Search brand..."
                />
              </div>
              <div>
                <label className="form-label">IVRS No.</label>
                <input className="crm-input" name="ivrsNo" value={editForm.ivrsNo} onChange={updateEditField} maxLength={10} />
              </div>
              <div>
                <label className="form-label">Capacity</label>
                <SearchableSelect
                  name="edit-capacity"
                  value={editForm.capacity}
                  onChange={(value) => setEditField('capacity', value)}
                  options={toOptions(CAPACITY_OPTIONS)}
                  placeholder="Select capacity..."
                  searchPlaceholder="Search capacity..."
                />
              </div>
              <div>
                <label className="form-label">Roof Type</label>
                <select className="crm-input" name="roofType" value={editForm.roofType} onChange={updateEditField}>
                  {['Concrete', 'Metal Sheet', 'RCC', 'Tin', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Monthly Bill</label>
                <input className="crm-input" name="monthlyBill" value={editForm.monthlyBill} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Monthly Unit</label>
                <input className="crm-input" name="monthlyUnit" value={editForm.monthlyUnit} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">PAN Card No.</label>
                <input className="crm-input" name="panCardNo" value={editForm.panCardNo} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Aadhar No.</label>
                <input className="crm-input" name="aadharNo" value={editForm.aadharNo} onChange={updateEditField} maxLength={12} />
              </div>
              <div>
                <label className="form-label">Account No.</label>
                <input className="crm-input" name="accountNo" value={editForm.accountNo} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">IFSC Code</label>
                <input className="crm-input" name="ifscCode" value={editForm.ifscCode} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">By / Through</label>
                <input className="crm-input" name="generatedThrough" value={editForm.generatedThrough} onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Source</label>
                <SearchableSelect
                  name="edit-source"
                  value={editForm.source}
                  onChange={(value) => setEditField('source', value)}
                  options={toOptions(SOURCES)}
                  placeholder="Select source..."
                  searchPlaceholder="Search source..."
                />
              </div>
              <div className="full">
                <label className="form-label">Other</label>
                <textarea className="crm-input" name="other" value={editForm.other} onChange={updateEditField} rows={2} />
              </div>
              <div>
                <label className="form-label">Photo 1</label>
                <input className="crm-input" type="file" name="photoOne" accept=".png,.jpg,.jpeg,.webp" onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Photo 2</label>
                <input className="crm-input" type="file" name="photoTwo" accept=".png,.jpg,.jpeg,.webp" onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Document PDF</label>
                <input className="crm-input" type="file" name="documentPdf" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Aadhar Card</label>
                <input className="crm-input" type="file" name="aadharCard" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">PAN Card</label>
                <input className="crm-input" type="file" name="panCard" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateEditField} />
              </div>
              <div>
                <label className="form-label">Bank Statement</label>
                <input className="crm-input" type="file" name="bankStatement" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateEditField} />
              </div>
            </div>
            <div className="dashboard-inline-actions" style={{ marginTop:12 }}>
              <button className="btn btn-primary" disabled={loading} onClick={doSavePreApprovalEdit}>Save Changes</button>
              <button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        )}

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

        {showReassign && (
          <div style={{ marginBottom:12 }}>
            <label className="form-label">Reassign Lead</label>
            <select
              className="crm-input"
              value={reassignUserId}
              disabled={loading || sameStageUsers.length === 0}
              onChange={(event) => setReassignUserId(event.target.value)}
            >
              <option value="">{sameStageUsers.length ? 'Select previous stage user' : 'No previous stage user available'}</option>
              {sameStageUsers.map((item) => (
                <option key={item._id} value={item._id}>{item.name} | {item.role}</option>
              ))}
            </select>
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
                    <input className="crm-input" maxLength={32} value={stageForm.panelNumber} onChange={(e) => setStageForm((prev) => ({ ...prev, panelNumber: e.target.value.slice(0, 32) }))} placeholder="Panel number" />
                  </div>
                  {stageForm.modulePanelNumbers.map((value, index) => (
                    <div key={`module-panel-${index}`}>
                      <label className="form-label">Module Panel No. {index + 1}</label>
                      <input
                        className="crm-input"
                        maxLength={32}
                        value={value}
                        onChange={(e) => setStageForm((prev) => {
                          const modulePanelNumbers = [...prev.modulePanelNumbers]
                          modulePanelNumbers[index] = e.target.value.slice(0, 32)
                          return { ...prev, modulePanelNumbers }
                        })}
                        placeholder={`Module panel no. ${index + 1}`}
                      />
                    </div>
                  ))}
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
              Approve {'->'} {isSalesManagerHandoff ? 'Manager' : STAGES[currentIndex + 1]}
            </button>
          )}
          {canAct && lead.status === 'active' && (
            <button className="btn btn-danger" disabled={loading} onClick={doReject}>Reject</button>
          )}
          {canApprove && nextStageRole && (
            <select
              className="crm-input"
              value={nextAssigneeId}
              disabled={loading || nextStageUsers.length === 0}
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
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(!showNote)}>Note</button>
          {showNote && note && (
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={doAddNote}>Save Note</button>
          )}
          {canReassign && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowReassign(!showReassign)}>Reassign</button>
          )}
          {showReassign && (
            <button className="btn btn-secondary btn-sm" disabled={loading || !reassignUserId} onClick={doReassign}>Save Reassign</button>
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
