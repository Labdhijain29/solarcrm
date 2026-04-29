import { useEffect, useMemo, useState } from 'react'
import { FaChartLine, FaCheckCircle, FaClipboardList, FaPlus, FaUsers } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { MetricCard, PageHeader } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'

const BRAND_OPTIONS = ['Tata', 'Vari', 'Adani']
const PINCODE_REGEX = /^\d{6}$/
const AADHAR_REGEX = /^\d{12}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const IVRS_REGEX = /^\d{10}$/

const INITIAL_FORM = {
  name: '',
  email: '',
  contact: '',
  state: '',
  city: '',
  addressdu: '',
  pincode: '',
  panCardNo: '',
  aadharNo: '',
  dealNo: '',
  brand: 'Tata',
  ivrsNo: '',
  accountNo: '',
  other: '',
  photoOne: null,
  photoTwo: null,
  documentPdf: null,
}

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)
const maskAadhar = (value) => value ? `${value.slice(0, 4)}-XXXX-${value.slice(-4)}` : ''
const maskAccount = (value) => {
  const trimmed = String(value || '').replace(/\s/g, '')
  if (!trimmed) return ''
  if (trimmed.length <= 4) return trimmed
  return `${'*'.repeat(Math.max(trimmed.length - 4, 0))}${trimmed.slice(-4)}`
}

function SalesExecutiveForm({ onClose, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const isSubmitDisabled = useMemo(() => {
    return (
      submitting ||
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.contact.trim() ||
      !formData.state.trim() ||
      !formData.city.trim() ||
      !formData.dealNo.trim()
    )
  }, [formData, submitting])

  const onInputChange = (event) => {
    const { name } = event.target
    let { value } = event.target

    if (name === 'contact' || name === 'ivrsNo') {
      value = normalizePhone(value)
    }
    if (name === 'pincode') {
      value = String(value || '').replace(/\D/g, '').slice(0, 6)
    }
    if (name === 'aadharNo') {
      value = String(value || '').replace(/\D/g, '').slice(0, 12)
    }
    if (name === 'panCardNo') {
      value = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    }
    if (name === 'dealNo') {
      value = String(value || '').replace(/\D/g, '').slice(0, 12)
    }
    if (name === 'accountNo') {
      value = String(value || '').replace(/[^\dA-Za-z]/g, '').slice(0, 24)
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const onFileChange = (event) => {
    const { name, files } = event.target
    setFormData((prev) => ({ ...prev, [name]: files?.[0] || null }))
  }

  const submit = async (event) => {
    event.preventDefault()

    if (!PHONE_REGEX.test(formData.contact)) {
      toast.error('Contact number must be a valid 10-digit mobile number.')
      return
    }
    if (!PINCODE_REGEX.test(formData.pincode)) {
      toast.error('Pincode must be 6 digits.')
      return
    }
    if (!AADHAR_REGEX.test(formData.aadharNo)) {
      toast.error('Aadhar number must be 12 digits.')
      return
    }
    if (!PAN_REGEX.test(formData.panCardNo)) {
      toast.error('PAN format must be ABCDE1234F.')
      return
    }
    if (!IVRS_REGEX.test(formData.ivrsNo)) {
      toast.error('IVRS number must be 10 digits.')
      return
    }

    const noteLines = [
      'Sales Executive Registration',
      `Deal No: ${formData.dealNo}`,
      `Brand: ${formData.brand}`,
      `IVRS No: ${formData.ivrsNo}`,
      `PAN: ${formData.panCardNo}`,
      `Aadhar: ${maskAadhar(formData.aadharNo)}`,
      `Account No: ${maskAccount(formData.accountNo) || '-'}`,
      `Other Details: ${formData.other || '-'}`,
      `Photo 1 File: ${formData.photoOne?.name || 'Not provided'}`,
      `Photo 2 File: ${formData.photoTwo?.name || 'Not provided'}`,
      `PDF File: ${formData.documentPdf?.name || 'Not provided'}`,
      'Uploads are currently recorded as file names because a dedicated document upload API is not available yet.',
    ]

    try {
      setSubmitting(true)
      await leadsAPI.create({
        name: formData.name.trim(),
        phone: formData.contact,
        email: formData.email.trim().toLowerCase(),
        address: formData.addressdu.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode,
        ivrsNo: formData.ivrsNo,
        source: 'Referral',
        generatedThrough: `Sales Executive | ${formData.brand} | Deal ${formData.dealNo}`,
        capacity: '3kW',
        notes: noteLines.join('\n'),
        salesExecutiveData: {
          contact: formData.contact,
          state: formData.state.trim(),
          city: formData.city.trim(),
          addressdu: formData.addressdu.trim(),
          pincode: formData.pincode,
          panCardNo: formData.panCardNo,
          aadharNo: formData.aadharNo,
          dealNo: formData.dealNo,
          brand: formData.brand,
          accountNo: formData.accountNo,
          other: formData.other.trim(),
          photoOneName: formData.photoOne?.name || '',
          photoTwoName: formData.photoTwo?.name || '',
          documentPdfName: formData.documentPdf?.name || '',
        },
        tags: ['sales-executive', formData.brand.toLowerCase(), `deal-${formData.dealNo}`],
      })
      toast.success('Lead sent to the manager. The registration flow will continue after approval.')
      onCreated()
      setFormData(INITIAL_FORM)
      onClose()
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.message
      toast.error(validationMessage || error.response?.data?.message || 'Registration save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box sales-exec-modal">
        <div className="sales-exec-hero">
          <div>
            <div className="sales-exec-kicker">Solar Channel Partner</div>
            <h2>Sales Executive Registration</h2>
            <p>ZIP wale onboarding form ko CRM dashboard ke andar merge kiya gaya hai. Add button se yahi form open hoga.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="sales-exec-note">
          Core details CRM lead ke roop mein save hongi. Image aur PDF abhi filename level par note mein record ho rahe hain kyunki dedicated upload API abhi project mein nahi hai.
        </div>

        <form className="sales-exec-form" onSubmit={submit}>
          <p className="sales-exec-section full">Personal Details</p>

          <label>
            Name
            <input className="crm-input" name="name" value={formData.name} onChange={onInputChange} placeholder="Enter full name" required />
          </label>

          <label>
            Email
            <input className="crm-input" type="email" name="email" value={formData.email} onChange={onInputChange} placeholder="Enter email" required />
          </label>

          <label>
            Contact
            <input className="crm-input" type="tel" name="contact" value={formData.contact} onChange={onInputChange} placeholder="9876543210" maxLength={10} required />
          </label>

          <label>
            State
            <input className="crm-input" name="state" value={formData.state} onChange={onInputChange} placeholder="Enter state" required />
          </label>

          <label>
            City
            <input className="crm-input" name="city" value={formData.city} onChange={onInputChange} placeholder="Enter city" required />
          </label>

          <label className="full">
            Address
            <textarea className="crm-input" name="addressdu" value={formData.addressdu} onChange={onInputChange} placeholder="Enter address" rows={3} />
          </label>

          <p className="sales-exec-section full">KYC Details</p>

          <label>
            Pincode
            <input className="crm-input" name="pincode" value={formData.pincode} onChange={onInputChange} placeholder="6-digit pincode" maxLength={6} required />
          </label>

          <label>
            PAN Card No.
            <input className="crm-input" name="panCardNo" value={formData.panCardNo} onChange={onInputChange} placeholder="ABCDE1234F" maxLength={10} required />
          </label>

          <label>
            Aadhar No.
            <input className="crm-input" name="aadharNo" value={formData.aadharNo} onChange={onInputChange} placeholder="12-digit Aadhar" maxLength={12} required />
          </label>

          <label>
            IVRS No.
            <input className="crm-input" name="ivrsNo" value={formData.ivrsNo} onChange={onInputChange} placeholder="10-digit IVRS" maxLength={10} required />
          </label>

          <p className="sales-exec-section full">Business Details</p>

          <label>
            Deal No.
            <input className="crm-input" name="dealNo" value={formData.dealNo} onChange={onInputChange} placeholder="Enter deal number" maxLength={12} required />
          </label>

          <label>
            Brand
            <select className="crm-input" name="brand" value={formData.brand} onChange={onInputChange}>
              {BRAND_OPTIONS.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </label>

          <label>
            Account No.
            <input className="crm-input" name="accountNo" value={formData.accountNo} onChange={onInputChange} placeholder="Enter account number" />
          </label>

          <label>
            Other
            <input className="crm-input" name="other" value={formData.other} onChange={onInputChange} placeholder="Additional details" />
          </label>

          <p className="sales-exec-section full">Uploads</p>

          <label>
            Photo 1 Upload
            <input className="crm-input" type="file" name="photoOne" accept="image/*" onChange={onFileChange} />
          </label>

          <label>
            Photo 2 Upload
            <input className="crm-input" type="file" name="photoTwo" accept="image/*" onChange={onFileChange} />
          </label>

          <label>
            Document (PDF)
            <input className="crm-input" type="file" name="documentPdf" accept="application/pdf" onChange={onFileChange} />
          </label>

          <div className="sales-exec-file-strip full">
            <span className="badge badge-blue">{formData.photoOne?.name || 'No photo 1 selected'}</span>
            <span className="badge badge-sun">{formData.photoTwo?.name || 'No photo 2 selected'}</span>
            <span className="badge badge-indigo">{formData.documentPdf?.name || 'No PDF selected'}</span>
          </div>

          <button type="submit" className="btn btn-primary sales-exec-submit" disabled={isSubmitDisabled}>
            {submitting ? 'Saving...' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SalesDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const { user } = useAuthStore()
  const isSalesExecutive = user?.role === 'Sales Executive'

  const fetchLeads = () => {
    setLoading(true)
    leadsAPI.getAll(isSalesExecutive ? { salesExecutiveOnly: true } : undefined)
      .then((response) => setLeads(response.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLeads()
  }, [])

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
        subtitle={isSalesExecutive ? 'Sirf isi dashboard se bani registrations aur unka latest status yahan dikhega' : 'Lead pipeline overview plus a dedicated registration form behind the Add button'}
        action={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <FaPlus /> Add Sales Executive
          </button>
        }
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaClipboardList />} label="Total Leads" value={stats.total} />
        <MetricCard icon={<FaCheckCircle />} label="Completed" value={stats.completed} changeColor="var(--green)" />
        <MetricCard icon={<FaChartLine />} label="Active" value={stats.active} changeColor="var(--blue)" />
        <MetricCard icon={<FaUsers />} label="Rejected" value={stats.rejected} changeColor="var(--red)" />
      </div>

      <div className="crm-card">
        <div className="sales-exec-toolbar">
          <div>
            <h3>Executive Leads</h3>
            <p>{isSalesExecutive ? 'Yahan sirf sales executive form se bani leads dikhengi, including completed status.' : 'New registrations yahin lead pipeline mein reflect hongi so the sales team can continue the workflow immediately.'}</p>
          </div>
          <span className="badge badge-sun">{user?.role || 'Sales Team'}</span>
        </div>
        <LeadsTable leads={leads} loading={loading} onView={setSelected} />
      </div>

      {showCreate && <SalesExecutiveForm onClose={() => setShowCreate(false)} onCreated={fetchLeads} />}
      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetchLeads} currentUser={user} />}
    </div>
  )
}
