import { useEffect, useMemo, useState } from 'react'
import { FaChartLine, FaCheckCircle, FaClipboardList, FaPlus, FaUsers } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { leadsAPI, usersAPI } from '../../services/api'
import { FilePreview, MetricCard, PageHeader } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'

const PINCODE_REGEX = /^\d{6}$/
const PHONE_REGEX = /^[6-9]\d{9}$/

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  alternateContact: '',
  state: '',
  city: '',
  permanentAddress: '',
  address: '',
  pincode: '',
  jobTitle: 'Sales Executive',
  dateOfJoining: '',
  documents: null,
}

const INITIAL_LEAD_FORM = {
  name: '',
  phone: '',
  email: '',
  state: '',
  city: '',
  address: '',
  pincode: '',
  ivrsNo: '',
  capacity: '',
  roofType: 'Concrete',
  monthlyBill: '',
  dealNo: '',
  brand: '',
  panCardNo: '',
  aadharNo: '',
  accountNo: '',
  other: '',
  photoOne: null,
  photoTwo: null,
  documentPdf: null,
}

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)

function SalesExecutiveForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const isSubmitDisabled = useMemo(() => (
    submitting ||
    !formData.name.trim() ||
    !formData.email.trim() ||
    !formData.password.trim() ||
    !formData.phone.trim() ||
    !formData.state.trim() ||
    !formData.city.trim()
  ), [formData, submitting])

  const onInputChange = (event) => {
    const { name } = event.target
    let { value } = event.target

    if (name === 'phone' || name === 'alternateContact') value = normalizePhone(value)
    if (name === 'pincode') value = String(value || '').replace(/\D/g, '').slice(0, 6)

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const onFileChange = (event) => {
    const { files } = event.target
    setFormData((prev) => ({ ...prev, documents: files?.[0] || null }))
  }

  const submit = async (event) => {
    event.preventDefault()

    if (!PHONE_REGEX.test(formData.phone)) {
      toast.error('Contact number must be a valid 10-digit mobile number.')
      return
    }
    if (formData.alternateContact && !PHONE_REGEX.test(formData.alternateContact)) {
      toast.error('Alternate contact must be a valid 10-digit mobile number.')
      return
    }
    if (formData.pincode && !PINCODE_REGEX.test(formData.pincode)) {
      toast.error('Pincode must be 6 digits.')
      return
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    const payload = new FormData()
    payload.append('name', formData.name.trim())
    payload.append('email', formData.email.trim().toLowerCase())
    payload.append('password', formData.password)
    payload.append('role', 'Sales Executive')
    payload.append('phone', formData.phone)
    payload.append('alternateContact', formData.alternateContact)
    payload.append('permanentAddress', formData.permanentAddress.trim())
    payload.append('address', formData.address.trim())
    payload.append('state', formData.state.trim())
    payload.append('city', formData.city.trim())
    payload.append('pincode', formData.pincode)
    payload.append('jobTitle', formData.jobTitle.trim() || 'Sales Executive')
    payload.append('dateOfJoining', formData.dateOfJoining)
    if (formData.documents) payload.append('documents', formData.documents)

    try {
      setSubmitting(true)
      await usersAPI.create(payload)
      toast.success('Sales Executive user created with uploaded document.')
      onCreated()
      setFormData(INITIAL_FORM)
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sales Executive creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box sales-exec-modal">
        <div className="sales-exec-hero">
          <div>
            <div className="sales-exec-kicker">System User</div>
            <h2>Add Sales Executive</h2>
            <p>Create a CRM login for a new Sales Executive. Uploaded document is saved in registration uploads.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="sales-exec-note">
          Use this screen for sales team onboarding. The created user can log in with the email and password entered here.
        </div>

        <form className="sales-exec-form" onSubmit={submit}>
          <p className="sales-exec-section full">Login Details</p>

          <label>
            Name
            <input className="crm-input" name="name" value={formData.name} onChange={onInputChange} placeholder="Enter full name" required />
          </label>

          <label>
            Email
            <input className="crm-input" type="email" name="email" value={formData.email} onChange={onInputChange} placeholder="Enter email" required />
          </label>

          <label>
            Password
            <input className="crm-input" type="password" name="password" value={formData.password} onChange={onInputChange} placeholder="Minimum 6 characters" minLength={6} required />
          </label>

          <label>
            Role
            <input className="crm-input" value="Sales Executive" disabled />
          </label>

          <p className="sales-exec-section full">Contact Details</p>

          <label>
            Contact
            <input className="crm-input" type="tel" name="phone" value={formData.phone} onChange={onInputChange} placeholder="9876543210" maxLength={10} required />
          </label>

          <label>
            Alternate Contact
            <input className="crm-input" type="tel" name="alternateContact" value={formData.alternateContact} onChange={onInputChange} placeholder="Optional" maxLength={10} />
          </label>

          <label>
            State
            <input className="crm-input" name="state" value={formData.state} onChange={onInputChange} placeholder="Enter state" required />
          </label>

          <label>
            City
            <input className="crm-input" name="city" value={formData.city} onChange={onInputChange} placeholder="Enter city" required />
          </label>

          <label>
            Pincode
            <input className="crm-input" name="pincode" value={formData.pincode} onChange={onInputChange} placeholder="6-digit pincode" maxLength={6} />
          </label>

          <label>
            Job Title
            <input className="crm-input" name="jobTitle" value={formData.jobTitle} onChange={onInputChange} placeholder="Sales Executive" />
          </label>

          <label className="full">
            Permanent Address
            <textarea className="crm-input" name="permanentAddress" value={formData.permanentAddress} onChange={onInputChange} placeholder="Enter permanent address" rows={2} />
          </label>

          <label className="full">
            Current Address
            <textarea className="crm-input" name="address" value={formData.address} onChange={onInputChange} placeholder="Enter current address" rows={2} />
          </label>

          <p className="sales-exec-section full">Joining & Upload</p>

          <label>
            Date of Joining
            <input className="crm-input" type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={onInputChange} />
          </label>

          <label>
            Document Upload
            <input className="crm-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={onFileChange} />
          </label>

          <div className="sales-exec-file-strip full">
            {formData.documents ? (
              <FilePreview file={formData.documents} label="Selected document" compact />
            ) : (
              <span className="badge badge-indigo">No document selected</span>
            )}
          </div>

          <button type="submit" className="btn btn-primary sales-exec-submit" disabled={isSubmitDisabled}>
            {submitting ? 'Creating...' : 'Create Sales Executive'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SalesExecutiveLeadForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_LEAD_FORM)
  const [submitting, setSubmitting] = useState(false)

  const isSubmitDisabled = useMemo(() => (
    submitting ||
    !formData.name.trim() ||
    !formData.phone.trim() ||
    !formData.state.trim() ||
    !formData.city.trim()
  ), [formData, submitting])

  const onInputChange = (event) => {
    const { name } = event.target
    let { value } = event.target

    if (name === 'phone') value = normalizePhone(value)
    if (name === 'pincode') value = String(value || '').replace(/\D/g, '').slice(0, 6)
    if (name === 'ivrsNo') value = String(value || '').replace(/\D/g, '').slice(0, 10)
    if (name === 'aadharNo') value = String(value || '').replace(/\D/g, '').slice(0, 12)
    if (name === 'monthlyBill') value = String(value || '').replace(/[^\d.]/g, '')

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const onFileChange = (event) => {
    const { name, files } = event.target
    setFormData((prev) => ({ ...prev, [name]: files?.[0] || null }))
  }

  const submit = async (event) => {
    event.preventDefault()

    if (!PHONE_REGEX.test(formData.phone)) {
      toast.error('Contact number must be a valid 10-digit mobile number.')
      return
    }
    if (formData.pincode && !PINCODE_REGEX.test(formData.pincode)) {
      toast.error('Pincode must be 6 digits.')
      return
    }
    if (formData.ivrsNo && !/^\d{10}$/.test(formData.ivrsNo)) {
      toast.error('IVRS number must be 10 digits.')
      return
    }

    const salesExecutiveData = {
      contact: formData.phone,
      state: formData.state.trim(),
      city: formData.city.trim(),
      addressdu: formData.address.trim(),
      pincode: formData.pincode,
      dealNo: formData.dealNo.trim(),
      brand: formData.brand.trim(),
      panCardNo: formData.panCardNo.trim(),
      aadharNo: formData.aadharNo.trim(),
      accountNo: formData.accountNo.trim(),
      other: formData.other.trim(),
      photoOneName: formData.photoOne?.name || '',
      photoTwoName: formData.photoTwo?.name || '',
      documentPdfName: formData.documentPdf?.name || '',
    }

    const payload = new FormData()
    payload.append('name', formData.name.trim())
    payload.append('phone', formData.phone)
    payload.append('email', formData.email.trim().toLowerCase())
    payload.append('state', formData.state.trim())
    payload.append('city', formData.city.trim())
    payload.append('address', formData.address.trim())
    payload.append('pincode', formData.pincode)
    payload.append('ivrsNo', formData.ivrsNo)
    payload.append('source', 'Other')
    payload.append('generatedThrough', 'Sales Executive Registration')
    payload.append('capacity', formData.capacity.trim() || '3kW')
    payload.append('roofType', formData.roofType)
    payload.append('monthlyBill', formData.monthlyBill || 0)
    payload.append('notes', `Sales Executive Registration${formData.other.trim() ? ` | Other: ${formData.other.trim()}` : ''}`)
    payload.append('tags', JSON.stringify(['sales-executive']))
    payload.append('salesExecutiveData', JSON.stringify(salesExecutiveData))
    if (formData.photoOne) payload.append('photoOne', formData.photoOne)
    if (formData.photoTwo) payload.append('photoTwo', formData.photoTwo)
    if (formData.documentPdf) payload.append('documentPdf', formData.documentPdf)

    try {
      setSubmitting(true)
      await leadsAPI.create(payload)
      toast.success('Sales executive registration submitted.')
      onCreated()
      setFormData(INITIAL_LEAD_FORM)
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box sales-exec-modal">
        <div className="sales-exec-hero">
          <div>
            <div className="sales-exec-kicker">Customer Registration</div>
            <h2>Sales Executive Form</h2>
            <p>Add customer details, IVRS and uploaded documents. This goes to Manager approval first.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <form className="sales-exec-form" onSubmit={submit}>
          <p className="sales-exec-section full">Customer Details</p>

          <label>
            Customer Name
            <input className="crm-input" name="name" value={formData.name} onChange={onInputChange} placeholder="Enter customer name" required />
          </label>

          <label>
            Contact
            <input className="crm-input" type="tel" name="phone" value={formData.phone} onChange={onInputChange} placeholder="9876543210" maxLength={10} required />
          </label>

          <label>
            Email
            <input className="crm-input" type="email" name="email" value={formData.email} onChange={onInputChange} placeholder="Optional" />
          </label>

          <label>
            State
            <input className="crm-input" name="state" value={formData.state} onChange={onInputChange} placeholder="Enter state" required />
          </label>

          <label>
            City
            <input className="crm-input" name="city" value={formData.city} onChange={onInputChange} placeholder="Enter city" required />
          </label>

          <label>
            Pincode
            <input className="crm-input" name="pincode" value={formData.pincode} onChange={onInputChange} placeholder="6-digit pincode" maxLength={6} />
          </label>

          <label className="full">
            Address
            <textarea className="crm-input" name="address" value={formData.address} onChange={onInputChange} placeholder="Enter customer address" rows={2} />
          </label>

          <p className="sales-exec-section full">Project & KYC Details</p>

          <label>
            Deal No.
            <input className="crm-input" name="dealNo" value={formData.dealNo} onChange={onInputChange} placeholder="Deal number" />
          </label>

          <label>
            Brand
            <input className="crm-input" name="brand" value={formData.brand} onChange={onInputChange} placeholder="Panel / inverter brand" />
          </label>

          <label>
            IVRS No.
            <input className="crm-input" name="ivrsNo" value={formData.ivrsNo} onChange={onInputChange} placeholder="10-digit IVRS" maxLength={10} />
          </label>

          <label>
            Capacity
            <input className="crm-input" name="capacity" value={formData.capacity} onChange={onInputChange} placeholder="3kW" />
          </label>

          <label>
            Roof Type
            <select className="crm-input" name="roofType" value={formData.roofType} onChange={onInputChange}>
              {['Concrete', 'Metal Sheet', 'RCC', 'Tin', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            Monthly Bill
            <input className="crm-input" name="monthlyBill" value={formData.monthlyBill} onChange={onInputChange} placeholder="Amount" />
          </label>

          <label>
            PAN Card No.
            <input className="crm-input" name="panCardNo" value={formData.panCardNo} onChange={onInputChange} placeholder="PAN number" />
          </label>

          <label>
            Aadhar No.
            <input className="crm-input" name="aadharNo" value={formData.aadharNo} onChange={onInputChange} placeholder="12-digit Aadhar" maxLength={12} />
          </label>

          <label>
            Account No.
            <input className="crm-input" name="accountNo" value={formData.accountNo} onChange={onInputChange} placeholder="Bank account number" />
          </label>

          <label className="full">
            Other
            <textarea className="crm-input" name="other" value={formData.other} onChange={onInputChange} placeholder="Any extra detail" rows={2} />
          </label>

          <p className="sales-exec-section full">Uploads</p>

          <label>
            Photo 1
            <input className="crm-input" type="file" name="photoOne" accept=".png,.jpg,.jpeg,.webp" onChange={onFileChange} />
          </label>

          <label>
            Photo 2
            <input className="crm-input" type="file" name="photoTwo" accept=".png,.jpg,.jpeg,.webp" onChange={onFileChange} />
          </label>

          <label>
            Document PDF
            <input className="crm-input" type="file" name="documentPdf" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={onFileChange} />
          </label>

          <div className="sales-exec-file-strip full">
            <FilePreview file={formData.photoOne} label="Photo 1" compact />
            <FilePreview file={formData.photoTwo} label="Photo 2" compact />
            <FilePreview file={formData.documentPdf} label="Document PDF" compact />
          </div>

          <button type="submit" className="btn btn-primary sales-exec-submit" disabled={isSubmitDisabled}>
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SalesDashboard() {
  const [leads, setLeads] = useState([])
  const [salesExecutives, setSalesExecutives] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showExecutiveCreate, setShowExecutiveCreate] = useState(false)
  const [showLeadCreate, setShowLeadCreate] = useState(false)
  const { user } = useAuthStore()
  const isSalesExecutive = user?.role === 'Sales Executive'
  const canCreateSalesRegistration = ['Admin', 'Sales Executive', 'Sales Manager'].includes(user?.role)

  const fetchLeads = () => {
    setLoading(true)
    leadsAPI.getAll({ salesExecutiveOnly: true, sort: 'latest', limit: 100 })
      .then((response) => setLeads(response.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const fetchSalesExecutives = () => {
    if (user?.role !== 'Admin') return
    usersAPI.getAll()
      .then((response) => {
        setSalesExecutives((response.data.data || []).filter((item) => item.role === 'Sales Executive'))
      })
      .catch(console.error)
  }

  const refreshData = () => {
    fetchLeads()
    fetchSalesExecutives()
  }

  useEffect(() => {
    refreshData()
  }, [user?.role])

  const stats = {
    total: leads.length,
    active: leads.filter((lead) => lead.status === 'active').length,
    completed: leads.filter((lead) => lead.status === 'completed').length,
    rejected: leads.filter((lead) => lead.status === 'rejected').length,
  }

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaUsers />}
        title="Sales Executive Dashboard"
        subtitle={isSalesExecutive ? 'Sirf isi dashboard se bani registrations aur unka latest status yahan dikhega' : 'Old sales executive registration form yahin se create hoga aur process me details show hongi'}
        action={
          <div className="dashboard-inline-actions">
            {canCreateSalesRegistration && (
              <button className="btn btn-primary" onClick={() => setShowLeadCreate(true)}>
                <FaPlus /> Sales Executive Form
              </button>
            )}
            {user?.role === 'Admin' && (
              <button className="btn btn-ghost" onClick={() => setShowExecutiveCreate(true)}>
                <FaPlus /> Add Sales Executive
              </button>
            )}
          </div>
        }
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaClipboardList />} label="Total Leads" value={stats.total} />
        <MetricCard icon={<FaCheckCircle />} label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon={<FaChartLine />} label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon={<FaUsers />} label="Sales Executives" value={isSalesExecutive ? '-' : salesExecutives.length} change="Users" changeColor="var(--sun)" />
      </div>

      {user?.role === 'Admin' && <div className="crm-card" style={{ marginBottom:16 }}>
        <div className="sales-exec-toolbar">
          <div>
            <h3>Sales Executive Users</h3>
            <p>Use the Add button to create a Sales Executive login with optional uploaded registration document.</p>
          </div>
          <span className="badge badge-indigo">{salesExecutives.length} executives</span>
        </div>
        {!salesExecutives.length ? (
          <div style={{ fontSize:13, color:'var(--muted)' }}>No Sales Executive users found.</div>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {salesExecutives.map((executive) => (
                  <tr key={executive._id}>
                    <td><strong>{executive.name}</strong><div style={{ fontSize:11, color:'var(--muted)' }}>{executive.jobTitle || 'Sales Executive'}</div></td>
                    <td>{executive.email}</td>
                    <td>{executive.phone || '-'}</td>
                    <td><span className={`badge ${executive.approvalStatus === 'approved' ? 'badge-green' : 'badge-sun'}`}>{executive.approvalStatus || 'approved'}</span></td>
                    <td>{executive.dateOfJoining ? new Date(executive.dateOfJoining).toLocaleDateString('en-IN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      <div className="crm-card">
        <div className="sales-exec-toolbar">
          <div>
            <h3>Executive Leads</h3>
            <p>{isSalesExecutive ? 'Yahan sirf sales executive form se bani leads dikhengi, including completed status.' : 'Sales executive form se bani registrations yahin lead pipeline mein reflect hongi so the team can continue the workflow immediately.'}</p>
          </div>
          <span className="badge badge-sun">{user?.role || 'Sales Team'}</span>
        </div>
        <LeadsTable leads={leads} loading={loading} onView={setSelected} defaultSort="latest" />
      </div>

      {showExecutiveCreate && <SalesExecutiveForm onClose={() => setShowExecutiveCreate(false)} onCreated={refreshData} />}
      {showLeadCreate && <SalesExecutiveLeadForm onClose={() => setShowLeadCreate(false)} onCreated={refreshData} />}
      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetchLeads} currentUser={user} />}
    </div>
  )
}
