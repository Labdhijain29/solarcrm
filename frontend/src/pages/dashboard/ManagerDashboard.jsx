import { useState, useEffect } from 'react'
import { FaChartLine, FaCheckCircle, FaClipboardList, FaEdit, FaMoneyBillWave, FaRegBuilding, FaSolarPanel, FaTasks, FaUserCheck, FaUsers, FaWrench, FaBell, FaExchangeAlt, FaFileInvoice, FaBriefcase, FaShippingFast } from 'react-icons/fa'
import { dispatchAPI, leadsAPI } from '../../services/api'
import { FilePreview, MetricCard, PageHeader, Spinner, EmptyState, SearchableSelect } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'
import { CITIES, STAGES, ROLE_STAGE_MAP, stageColor } from '../../utils/constants'
import toast from 'react-hot-toast'
import { ALL_BRAND_OPTIONS } from './inventoryStructure'

const toOptions = (items) => items.map((item) => ({ value: item, label: item }))
const PHONE_REGEX = /^[6-9]\d{9}$/
const PINCODE_REGEX = /^\d{6}$/
const IVRS_REGEX = /^[A-Za-z0-9]{1,15}$/
const CAPACITY_OPTIONS = Array.from({ length: 50 }, (_, index) => `${index + 1}kW`)
const CAPITALIZED_FIELDS = new Set(['name', 'state', 'city', 'address', 'branch', 'brand', 'generatedThrough', 'other'])
const canEditBeforeApproval = (lead, role) => (
  lead?.status === 'active' && (
    (['Admin', 'Manager', 'Sales Executive', 'Sales Manager'].includes(role) && lead?.currentStage === 'Lead') ||
    (['Admin', 'Registration Executive'].includes(role) && lead?.currentStage === 'Registration')
  )
)
const INITIAL_MANAGER_LEAD = {
  name: '',
  phone: '',
  email: '',
  state: '',
  city: '',
  address: '',
  pincode: '',
  branch: '',
  ivrsNo: '',
  source: 'Website',
  generatedThrough: '',
  capacity: '3kW',
  roofType: 'Concrete',
  monthlyBill: '',
  dealNo: '',
  brand: '',
  panCardNo: '',
  aadharNo: '',
  accountNo: '',
  ifscCode: '',
  other: '',
  photoOne: null,
  photoTwo: null,
  documentPdf: null,
  aadharCard: null,
  panCard: null,
  bankStatement: null,
}
const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)
const capitalizeFirstLetter = (value) => String(value || '').replace(/^(\s*)([a-z])/, (_, spaces, letter) => `${spaces}${letter.toUpperCase()}`)

function KanbanPipeline({ leads, onView }) {
  return (
    <div className="kanban-wrap" style={{ overflowX: 'auto' }}>
      {STAGES.map(stage => {
        const cols = leads.filter(l => l.currentStage === stage)
        return (
          <div key={stage} className="kanban-col">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: stageColor(stage) }}>{stage.split(' ')[0]}</div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11, padding: '1px 7px' }}>{cols.length}</div>
            </div>
            {cols.slice(0, 5).map(l => (
              <div key={l._id} className="kanban-card" onClick={() => onView(l)}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.capacity} | {l.city}</div>
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {STAGES.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= STAGES.indexOf(stage) ? stageColor(stage) : 'var(--bg3)' }} />)}
                </div>
              </div>
            ))}
            {cols.length > 5 && <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>+{cols.length - 5} more</div>}
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
  const [editingLeadId, setEditingLeadId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newLead, setNewLead] = useState(INITIAL_MANAGER_LEAD)
  const { user } = useAuthStore()

  const fetchLeads = () => {
    leadsAPI.getAll({ sort: 'ivrs-asc' }).then(r => setLeads(r.data.data)).catch(console.error).finally(() => setLoading(false))
  }

  const viewLead = async (lead) => {
    setEditingLeadId('')
    setSelected(lead)
    try {
      const response = await leadsAPI.getOne(lead._id)
      setSelected(response.data.data)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load lead details')
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const createLead = async () => {
    const phone = normalizePhone(newLead.phone)
    if (!newLead.name.trim() || !phone) return toast.error('Name and phone are required')
    if (!PHONE_REGEX.test(phone)) return toast.error('Enter a valid 10-digit mobile number')
    if (!newLead.state.trim() || !newLead.city.trim()) return toast.error('State and city are required')
    if (!newLead.branch.trim()) return toast.error('Branch is required.')
    if (newLead.pincode && !PINCODE_REGEX.test(newLead.pincode)) return toast.error('Pincode must be 6 digits.')
    if (newLead.ivrsNo && !IVRS_REGEX.test(newLead.ivrsNo)) return toast.error('IVRS number must be up to 15 letters or digits.')

    const salesExecutiveData = {
      contact: phone,
      state: newLead.state.trim(),
      city: newLead.city.trim(),
      addressdu: newLead.address.trim(),
      pincode: newLead.pincode,
      branch: newLead.branch.trim(),
      dealNo: newLead.dealNo.trim(),
      brand: newLead.brand.trim(),
      panCardNo: newLead.panCardNo.trim(),
      aadharNo: newLead.aadharNo.trim(),
      accountNo: newLead.accountNo.trim(),
      ifscCode: newLead.ifscCode.trim().toUpperCase(),
      other: newLead.other.trim(),
      photoOneName: newLead.photoOne?.name || '',
      photoTwoName: newLead.photoTwo?.name || '',
      documentPdfName: newLead.documentPdf?.name || '',
      aadharCardName: newLead.aadharCard?.name || '',
      panCardName: newLead.panCard?.name || '',
      bankStatementName: newLead.bankStatement?.name || '',
    }

    const payload = new FormData()
    payload.append('name', newLead.name.trim())
    payload.append('phone', phone)
    payload.append('email', newLead.email.trim().toLowerCase())
    payload.append('state', newLead.state.trim())
    payload.append('city', newLead.city.trim())
    payload.append('address', newLead.address.trim())
    payload.append('pincode', newLead.pincode)
    payload.append('branch', newLead.branch.trim())
    payload.append('ivrsNo', newLead.ivrsNo)
    payload.append('source', newLead.source)
    payload.append('generatedThrough', newLead.generatedThrough.trim())
    payload.append('capacity', newLead.capacity.trim() || '3kW')
    payload.append('roofType', newLead.roofType)
    payload.append('monthlyBill', newLead.monthlyBill || 0)
    payload.append('notes', newLead.other.trim() ? `Other: ${newLead.other.trim()}` : '')
    payload.append('salesExecutiveData', JSON.stringify(salesExecutiveData))
    if (newLead.photoOne) payload.append('photoOne', newLead.photoOne)
    if (newLead.photoTwo) payload.append('photoTwo', newLead.photoTwo)
    if (newLead.documentPdf) payload.append('documentPdf', newLead.documentPdf)
    if (newLead.aadharCard) payload.append('aadharCard', newLead.aadharCard)
    if (newLead.panCard) payload.append('panCard', newLead.panCard)
    if (newLead.bankStatement) payload.append('bankStatement', newLead.bankStatement)

    try {
      await leadsAPI.create(payload)
      toast.success('Lead created!')
      setShowCreate(false)
      setNewLead(INITIAL_MANAGER_LEAD)
      fetchLeads()
    } catch (e) {
      const validationMessage = e.response?.data?.errors?.[0]?.message
      toast.error(validationMessage || e.response?.data?.message || 'Failed to create lead')
    }
  }

  const editLead = async (lead) => {
    setEditingLeadId(lead._id)
    setSelected(lead)
    try {
      const response = await leadsAPI.getOne(lead._id)
      setSelected(response.data.data)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load lead details')
    }
  }

  const updateNewLeadField = (event) => {
    const { name, files } = event.target
    let { value } = event.target

    if (files) {
      setNewLead((prev) => ({ ...prev, [name]: files?.[0] || null }))
      return
    }
    if (name === 'phone') value = normalizePhone(value)
    if (name === 'pincode') value = String(value || '').replace(/\D/g, '').slice(0, 6)
    if (name === 'ivrsNo') value = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 15)
    if (name === 'aadharNo') value = String(value || '').replace(/\D/g, '').slice(0, 12)
    if (name === 'ifscCode') value = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11)
    if (name === 'monthlyBill') value = String(value || '').replace(/[^\d.]/g, '')
    if (CAPITALIZED_FIELDS.has(name)) value = capitalizeFirstLetter(value)

    setNewLead((prev) => ({ ...prev, [name]: value }))
  }

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.status === 'active').length,
    completed: leads.filter(l => l.status === 'completed').length,
  }

  const leadRowActions = (lead) => canEditBeforeApproval(lead, user?.role) ? (
    <button className="btn btn-primary btn-sm" type="button" onClick={() => editLead(lead)} aria-label="Edit lead" title="Edit lead">
      <FaEdit />
    </button>
  ) : null

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaRegBuilding />}
        title="Manager Dashboard"
        subtitle="Generate leads, assign tasks, monitor the full pipeline"
        action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Lead</button>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaClipboardList />} label="Total Leads" value={stats.total} changeColor="var(--sun)" />
        <MetricCard icon={<FaTasks />} label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon={<FaCheckCircle />} label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon={<FaChartLine />} label="Conv. Rate" value={`${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}%`} changeColor="var(--indigo)" />
      </div>

      <div className="crm-tabs">
        {['leads', 'pipeline'].map(t => (
          <button key={t} className={`crm-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'leads' && <div className="crm-card"><LeadsTable leads={leads} loading={loading} onView={viewLead} extraActions={leadRowActions} onLeadUpdated={fetchLeads} /></div>}
      {tab === 'pipeline' && <KanbanPipeline leads={leads} onView={viewLead} />}

      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box sales-exec-modal">
            <div className="sales-exec-hero">
              <div>
                <div className="sales-exec-kicker">Customer Registration</div>
                <h2>Create New Lead</h2>
                <p>Add customer details, IVRS, project data and uploaded documents.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Close</button>
            </div>

            <form className="sales-exec-form" onSubmit={(event) => { event.preventDefault(); createLead() }}>
              <p className="sales-exec-section full">Customer Details</p>

              <label>
                Customer Name
                <input className="crm-input" name="name" value={newLead.name} onChange={updateNewLeadField} placeholder="Enter customer name" required />
              </label>

              <label>
                Contact
                <input className="crm-input" type="tel" name="phone" value={newLead.phone} onChange={updateNewLeadField} placeholder="9876543210" maxLength={10} required />
              </label>

              <label>
                Email
                <input className="crm-input" type="email" name="email" value={newLead.email} onChange={updateNewLeadField} placeholder="Optional" />
              </label>

              <label>
                State
                <input className="crm-input" name="state" value={newLead.state} onChange={updateNewLeadField} placeholder="Enter state" required />
              </label>

              <label>
                City
                <SearchableSelect
                  name="city"
                  value={newLead.city}
                  onChange={(value) => setNewLead(p => ({ ...p, city: value }))}
                  options={toOptions(CITIES)}
                  placeholder="Select city..."
                  searchPlaceholder="Search city..."
                />
              </label>

              <label>
                Pincode
                <input className="crm-input" name="pincode" value={newLead.pincode} onChange={updateNewLeadField} placeholder="6-digit pincode" maxLength={6} />
              </label>

              <label className="full">
                Address
                <textarea className="crm-input" name="address" value={newLead.address} onChange={updateNewLeadField} placeholder="Enter customer address" rows={2} />
              </label>

              <p className="sales-exec-section full">Project & KYC Details</p>

              <label>
                Deal No.
                <input className="crm-input" name="dealNo" value={newLead.dealNo} onChange={updateNewLeadField} placeholder="Deal number" />
              </label>

              <label>
                Branch
                <input className="crm-input" name="branch" value={newLead.branch} onChange={updateNewLeadField} placeholder="Proposal branch" required />
              </label>

              <label>
                Brand
                <SearchableSelect
                  name="manager-lead-brand"
                  value={newLead.brand}
                  onChange={(value) => setNewLead((prev) => ({ ...prev, brand: value }))}
                  options={toOptions(ALL_BRAND_OPTIONS)}
                  placeholder="Select brand..."
                  searchPlaceholder="Search brand..."
                />
              </label>

              <label>
                IVRS No.
                <input className="crm-input" name="ivrsNo" value={newLead.ivrsNo} onChange={updateNewLeadField} placeholder="Up to 15-digit IVRS" maxLength={15} />
              </label>

              <label>
                Capacity
                <SearchableSelect
                  name="manager-lead-capacity"
                  value={newLead.capacity}
                  onChange={(value) => setNewLead((prev) => ({ ...prev, capacity: value }))}
                  options={toOptions(CAPACITY_OPTIONS)}
                  placeholder="Select capacity..."
                  searchPlaceholder="Search capacity..."
                />
              </label>

              <label>
                Roof Type
                <select className="crm-input" name="roofType" value={newLead.roofType} onChange={updateNewLeadField}>
                  {['Concrete', 'Metal Sheet', 'RCC', 'Tin', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <label>
                Monthly Bill
                <input className="crm-input" name="monthlyBill" value={newLead.monthlyBill} onChange={updateNewLeadField} placeholder="Amount" />
              </label>

              <label>
                PAN Card No.
                <input className="crm-input" name="panCardNo" value={newLead.panCardNo} onChange={updateNewLeadField} placeholder="PAN number" />
              </label>

              <label>
                Aadhar No.
                <input className="crm-input" name="aadharNo" value={newLead.aadharNo} onChange={updateNewLeadField} placeholder="12-digit Aadhar" maxLength={12} />
              </label>

              <label>
                Account No.
                <input className="crm-input" name="accountNo" value={newLead.accountNo} onChange={updateNewLeadField} placeholder="Bank account number" />
              </label>

              <label>
                IFSC Code
                <input className="crm-input" name="ifscCode" value={newLead.ifscCode} onChange={updateNewLeadField} placeholder="IFSC code" />
              </label>

              <label>
                By / Through
                <input className="crm-input" name="generatedThrough" value={newLead.generatedThrough} onChange={updateNewLeadField} placeholder="Campaign, partner, employee, referral..." />
              </label>

              <label>
                Source
                <SearchableSelect
                  name="source"
                  value={newLead.source}
                  onChange={(value) => setNewLead(p => ({ ...p, source: value }))}
                  options={toOptions(['Website', 'Social Media', 'Referral', 'Cold Call', 'Exhibition', 'Google Ads', 'Other'])}
                  placeholder="Select source..."
                  searchPlaceholder="Search source..."
                />
              </label>

              <label className="full">
                Other
                <textarea className="crm-input" name="other" value={newLead.other} onChange={updateNewLeadField} placeholder="Any extra detail" rows={2} />
              </label>

              <p className="sales-exec-section full">Uploads</p>

              <label>
                Photo 1
                <input className="crm-input" type="file" name="photoOne" accept=".png,.jpg,.jpeg,.webp" onChange={updateNewLeadField} />
              </label>

              <label>
                Photo 2
                <input className="crm-input" type="file" name="photoTwo" accept=".png,.jpg,.jpeg,.webp" onChange={updateNewLeadField} />
              </label>

              <label>
                Document PDF
                <input className="crm-input" type="file" name="documentPdf" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateNewLeadField} />
              </label>

              <label>
                Aadhar Card
                <input className="crm-input" type="file" name="aadharCard" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateNewLeadField} />
              </label>

              <label>
                PAN Card
                <input className="crm-input" type="file" name="panCard" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateNewLeadField} />
              </label>

              <label>
                Bank Statement
                <input className="crm-input" type="file" name="bankStatement" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={updateNewLeadField} />
              </label>

              <div className="sales-exec-file-strip full">
                <FilePreview file={newLead.photoOne} label="Photo 1" compact />
                <FilePreview file={newLead.photoTwo} label="Photo 2" compact />
                <FilePreview file={newLead.documentPdf} label="Document PDF" compact />
                <FilePreview file={newLead.aadharCard} label="Aadhar Card" compact />
                <FilePreview file={newLead.panCard} label="PAN Card" compact />
                <FilePreview file={newLead.bankStatement} label="Bank Statement" compact />
              </div>

              <button type="submit" className="btn btn-primary sales-exec-submit">Create Lead</button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => {
            setSelected(null)
            setEditingLeadId('')
          }}
          onUpdated={fetchLeads}
          currentUser={user}
          startEditing={editingLeadId === selected._id}
        />
      )}
    </div>
  )
}

export function SalesDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editingLeadId, setEditingLeadId] = useState('')
  const { user } = useAuthStore()

  const fetchLeads = () => leadsAPI.getAll({ sort: 'ivrs-asc' }).then(r => setLeads(r.data.data)).catch(console.error).finally(() => setLoading(false))

  useEffect(() => {
    fetchLeads()
  }, [])

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.status === 'active').length,
    completed: leads.filter(l => l.status === 'completed').length,
    rejected: leads.filter(l => l.status === 'rejected').length,
  }

  const viewLead = (lead) => {
    setEditingLeadId('')
    setSelected(lead)
  }

  const editLead = (lead) => {
    setEditingLeadId(lead._id)
    setSelected(lead)
  }

  const leadRowActions = (lead) => canEditBeforeApproval(lead, user?.role) ? (
    <button className="btn btn-primary btn-sm" type="button" onClick={() => editLead(lead)} aria-label="Edit lead" title="Edit lead">
      <FaEdit />
    </button>
  ) : null

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaUsers />} title="Sales Manager Dashboard" subtitle="Full pipeline overview and conversion tracking" />
      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaClipboardList />} label="Total Leads" value={stats.total} />
        <MetricCard icon={<FaTasks />} label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon={<FaCheckCircle />} label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon={<FaChartLine />} label="Conv. Rate" value={`${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}%`} changeColor="var(--indigo)" />
      </div>
      <div className="crm-card">
        <LeadsTable leads={leads} loading={loading} onView={viewLead} extraActions={leadRowActions} onLeadUpdated={fetchLeads} />
      </div>
      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => {
            setSelected(null)
            setEditingLeadId('')
          }}
          onUpdated={fetchLeads}
          currentUser={user}
          startEditing={editingLeadId === selected._id}
        />
      )}
    </div>
  )
}

const STAGE_ROLE_ICONS = {
  'Registration Executive': FaClipboardList,
  'Bank/Finance Executive': FaBriefcase,
  'Loan Officer': FaMoneyBillWave,
  'Dispatch Manager': FaExchangeAlt,
  'Installation Manager': FaSolarPanel,
  'Net Metering Officer': FaBell,
  'Subsidy Officer': FaFileInvoice,
  'Subsidy Reading Officer': FaFileInvoice,
}

const INSTALLATION_DISPATCH_STATUSES = ['Pending', 'In Progress', 'Completed']

export function StageDashboard({ roleOverride }) {
  const [leads, setLeads] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editingLeadId, setEditingLeadId] = useState('')
  const [panelNumbers, setPanelNumbers] = useState({})
  const [savingPanelId, setSavingPanelId] = useState('')
  const [installationDispatches, setInstallationDispatches] = useState([])
  const [selectedDispatch, setSelectedDispatch] = useState(null)
  const [savingDispatchId, setSavingDispatchId] = useState('')
  const { user } = useAuthStore()
  const dashboardRole = roleOverride || user?.role
  const myStage = ROLE_STAGE_MAP[dashboardRole]
  const showPanelNumberRows = dashboardRole === 'Installation Manager'

  const fetchLeads = () => {
    setLoading(true)
    const requests = [
      leadsAPI.getAll({ stage: myStage, sort: 'ivrs-asc' }),
      leadsAPI.getAll({ completedStage: myStage, sort: 'ivrs-asc' }),
    ]
    if (showPanelNumberRows) requests.push(dispatchAPI.getAll())

    Promise.all(requests)
      .then(([activeRes, completedRes, dispatchRes]) => {
        const nextLeads = activeRes.data.data || []
        setLeads(nextLeads)
        setPanelNumbers(Object.fromEntries(nextLeads.map((lead) => [lead._id, lead.installationData?.panelNumber || ''])))
        setCompletedCount(completedRes.data.pagination?.total ?? completedRes.data.data?.length ?? 0)
        setInstallationDispatches(dispatchRes?.data?.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(fetchLeads, [myStage])

  const activeLeads = leads.filter((lead) => lead.status === 'active')
  const approvedInstallationDispatches = installationDispatches.filter((dispatch) => dispatch.approvalStatus === 'Approved')

  const viewStageLead = (lead) => {
    setEditingLeadId('')
    setSelected(lead)
  }

  const editStageLead = (lead) => {
    setEditingLeadId(lead._id)
    setSelected(lead)
  }

  const getLeadDispatch = (lead) => {
    const leadKeys = [
      lead._id,
      lead.ivrsNo,
      String(lead._id || '').slice(-6),
    ].filter(Boolean).map((value) => String(value).toLowerCase())
    const phone = String(lead.phone || '').replace(/\D/g, '')

    return installationDispatches.find((dispatch) => {
      const dispatchLeadId = String(dispatch.leadId || '').toLowerCase()
      const dispatchMobile = String(dispatch.mobile || '').replace(/\D/g, '')
      return leadKeys.includes(dispatchLeadId) || (phone && dispatchMobile === phone)
    })
  }

  const savePanelNumber = async (lead) => {
    const panelNumber = String(panelNumbers[lead._id] || '').trim()
    if (!panelNumber) {
      toast.error('Panel number is required.')
      return
    }

    setSavingPanelId(lead._id)
    try {
      await leadsAPI.update(lead._id, {
        installationData: { panelNumber },
        updateNote: `Panel number updated: ${panelNumber}`,
      })
      toast.success('Panel number saved')
      fetchLeads()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save panel number')
    } finally {
      setSavingPanelId('')
    }
  }

  const installationPanelAction = (lead) => {
    if (!showPanelNumberRows || lead.currentStage !== 'Installation') return null
    const dispatch = getLeadDispatch(lead)

    return (
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        {dispatch && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelectedDispatch(dispatch)}>
            View Bill
          </button>
        )}
        <input
          className="crm-input"
          maxLength={32}
          value={panelNumbers[lead._id] || ''}
          onChange={(event) => setPanelNumbers((prev) => ({
            ...prev,
            [lead._id]: event.target.value.slice(0, 32),
          }))}
          placeholder="Panel no."
          style={{ width:140, height:32, fontSize:12 }}
        />
        <button className="btn btn-secondary btn-sm" disabled={savingPanelId === lead._id} onClick={() => savePanelNumber(lead)}>
          Save Panel
        </button>
      </div>
    )
  }

  const stageRowActions = (lead) => (
    <>
      {canEditBeforeApproval(lead, user?.role) && (
        <button className="btn btn-primary btn-sm" type="button" onClick={() => editStageLead(lead)} aria-label="Edit lead" title="Edit lead">
          <FaEdit />
        </button>
      )}
      {installationPanelAction(lead)}
    </>
  )

  const updateDispatchInstallationStatus = async (dispatch, status) => {
    setSavingDispatchId(dispatch._id)
    try {
      const response = await dispatchAPI.updateInstallationStatus(dispatch._id, status)
      const updatedDispatch = response.data.data
      if (updatedDispatch?._id) {
        setInstallationDispatches((prev) => prev.map((item) => item._id === updatedDispatch._id ? updatedDispatch : item))
        setSelectedDispatch((prev) => prev?._id === updatedDispatch._id ? updatedDispatch : prev)
      }
      toast.success('Installation status updated')
      fetchLeads()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Status update failed')
    } finally {
      setSavingDispatchId('')
    }
  }

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={(() => { const Icon = STAGE_ROLE_ICONS[dashboardRole] || FaUserCheck; return <Icon /> })()}
        title={`${dashboardRole} Dashboard`}
        subtitle={<>Stage: <strong style={{ color: stageColor(myStage) }}>{myStage}</strong> - review and action leads for this role</>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaTasks />} label="Pending Action" value={activeLeads.length} changeColor="var(--sun)" />
        <MetricCard icon={<FaCheckCircle />} label="Completed Leads" value={completedCount} changeColor="var(--green)" />
        <MetricCard icon={<FaWrench />} label="My Stage" value={myStage?.split(' ')[0]} />
        <MetricCard icon={<FaUserCheck />} label="Visible To" value={dashboardRole?.split(' ')[0]} />
        {showPanelNumberRows && <MetricCard icon={<FaShippingFast />} label="Dispatch Bills" value={installationDispatches.length} change={`${approvedInstallationDispatches.length} approved`} changeColor="var(--blue)" />}
      </div>

      {loading ? <Spinner /> : activeLeads.length === 0 ? (
        <div className="crm-card">
          <EmptyState icon={<FaCheckCircle />} title="All caught up!" subtitle={`No leads pending at the ${myStage} stage`} />
        </div>
      ) : (
        <div className="crm-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Leads at {myStage} ({activeLeads.length})</h3>
          <LeadsTable leads={activeLeads} loading={false} onView={viewStageLead} extraActions={stageRowActions} onLeadUpdated={fetchLeads} />
        </div>
      )}

      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => {
            setSelected(null)
            setEditingLeadId('')
          }}
          onUpdated={fetchLeads}
          currentUser={user}
          startEditing={editingLeadId === selected._id}
          showRegistrationPhotoUpload={dashboardRole === 'Registration Executive'}
          showBankRemarkInput={dashboardRole === 'Bank/Finance Executive'}
          showLoanApplicationInput={dashboardRole === 'Loan Officer'}
          showInstallationInput={dashboardRole === 'Installation Manager'}
          showNetMeteringInput={dashboardRole === 'Net Metering Officer'}
          showSubsidyInput={dashboardRole === 'Subsidy Officer'}
          showSubsidyReadingInput={dashboardRole === 'Subsidy Reading Officer'}
        />
      )}

      {selectedDispatch && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelectedDispatch(null)}>
          <div className="modal-box" style={{ maxWidth: 880 }}>
            <div className="dashboard-split-row" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700 }}>{selectedDispatch.billNo || 'Dispatch Bill'}</h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {selectedDispatch.customerName} | {selectedDispatch.mobile} | {selectedDispatch.siteAddress}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelectedDispatch(null)}>Close</button>
            </div>

            <div className="dashboard-grid-metrics" style={{ marginBottom: 16 }}>
              <MetricCard icon={<FaShippingFast />} label="Approval" value={selectedDispatch.approvalStatus || 'Pending'} change={selectedDispatch.billLocked ? 'Bill locked' : 'Waiting'} changeColor="var(--blue)" />
              <MetricCard icon={<FaSolarPanel />} label="Installation" value={selectedDispatch.installationStatus || 'Pending'} change="Current status" changeColor="var(--sun)" />
              <MetricCard icon={<FaClipboardList />} label="Material Qty" value={(selectedDispatch.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} change="Total items" />
              <MetricCard icon={<FaMoneyBillWave />} label="Grand Total" value={`Rs. ${Number(selectedDispatch.grandTotal || 0).toLocaleString('en-IN')}`} change="Bill amount" changeColor="var(--green)" />
            </div>

            <div className="dashboard-form-grid" style={{ marginBottom: 16 }}>
              <div><label className="form-label">Lead ID / IVRS</label><div className="crm-input" style={{ height: 'auto' }}>{selectedDispatch.leadId || '-'}</div></div>
              <div><label className="form-label">Engineer</label><div className="crm-input" style={{ height: 'auto' }}>{selectedDispatch.installationAssigneeName || selectedDispatch.engineerName || '-'}</div></div>
              <div><label className="form-label">Dispatch Date</label><div className="crm-input" style={{ height: 'auto' }}>{selectedDispatch.dispatchDate ? new Date(selectedDispatch.dispatchDate).toLocaleDateString('en-IN') : '-'}</div></div>
              <div>
                <label className="form-label">Installation Status</label>
                <select
                  className="crm-input"
                  value={selectedDispatch.installationStatus || 'Pending'}
                  disabled={selectedDispatch.approvalStatus !== 'Approved' || savingDispatchId === selectedDispatch._id}
                  onChange={(event) => updateDispatchInstallationStatus(selectedDispatch, event.target.value)}
                >
                  {INSTALLATION_DISPATCH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Brand</th><th>Capacity</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {(selectedDispatch.items || []).map((item) => (
                    <tr key={`${selectedDispatch._id}-${item.productId}`}>
                      <td>{item.productName}</td>
                      <td>{item.category || '-'}</td>
                      <td>{item.brand || '-'}</td>
                      <td>{item.capacity || '-'}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>Rs. {Number(item.price || 0).toLocaleString('en-IN')}</td>
                      <td>Rs. {Number(item.lineTotal || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerDashboard
