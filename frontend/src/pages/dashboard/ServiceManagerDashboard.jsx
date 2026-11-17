import { useEffect, useRef, useState } from 'react'
import { FaCheckCircle, FaPauseCircle, FaTasks, FaTools } from 'react-icons/fa'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import ServiceRequestForm from '../../components/dashboard/ServiceRequestForm'
import ServiceRequestDetails from '../../components/dashboard/ServiceRequestDetails'
import ServiceStatusControl from '../../components/dashboard/ServiceStatusControl'
import { SERVICE_STATUS_LABELS, requestServiceStatusChange } from '../../utils/serviceRequestStatus'
import toast from 'react-hot-toast'
import { FaEdit } from 'react-icons/fa'
import { serviceRequestsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { formatFollowUpDate } from '../../utils/enquiryFollowUp'

export default function ServiceManagerDashboard() {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState([])
  const [counts, setCounts] = useState({})
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [editingRequest, setEditingRequest] = useState(null)
  const [loadingEditId, setLoadingEditId] = useState('')
  const [changingId, setChangingId] = useState('')
  const statusPending = useRef(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      serviceRequestsAPI.getAll({ status, search: search.trim(), page }).then(response => {
        if (!alive) return
        setRequests(response.data.data || [])
        setCounts(response.data.counts || {})
        setPagination(response.data.pagination)
        setError('')
        if (response.data.pagination.page !== page) setPage(response.data.pagination.page)
      }).catch(error => {
        if (alive) setError(error.response?.data?.message || 'Could not load service requests.')
      }).finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [status, search, page, revision])

  const changeStatus = value => { setStatus(value); setPage(1) }
  const refresh = () => setRevision(value => value + 1)
  const changeRequestStatus = async request => {
    if (statusPending.current) return
    statusPending.current = true
    setChangingId(request._id)
    try {
      const result = await requestServiceStatusChange(request, { onConflict: refresh })
      if (result) { toast.success(result.message); refresh() }
    } finally { statusPending.current = false; setChangingId('') }
  }
  const openEdit = async request => {
    if (loadingEditId) return
    setLoadingEditId(request._id)
    try { setEditingRequest((await serviceRequestsAPI.getOne(request._id)).data.data) }
    catch (error) { toast.error(error.response?.data?.message || 'Could not open service request.') }
    finally { setLoadingEditId('') }
  }
  const listStatus = request => <ServiceStatusControl request={request} disabled={Boolean(changingId || loadingEditId)} onClick={() => changeRequestStatus(request)} />
  const rowActions = request => <div className="service-list-actions">
    <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(changingId || loadingEditId)} onClick={() => setSelectedId(request._id)} aria-label={`View ${request.requestNo}`}>View</button>
    <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(changingId || loadingEditId)} onClick={() => openEdit(request)} aria-label={`Edit ${request.requestNo}`}><FaEdit aria-hidden="true" />{loadingEditId === request._id ? 'Opening...' : 'Edit'}</button>
  </div>

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

  return (
    <div className="dashboard-page compact-list-region service-dashboard">
      <PageHeader icon={<FaTools />} title="Service Manager Dashboard" subtitle={user.role === 'Admin' ? 'Manage service requests and assignments' : 'Manage your assigned service requests'} action={<button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>New Service Request</button>} />
      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaTasks />} label="Pending" value={counts.pending || 0} changeColor="var(--sun)" onClick={() => changeStatus('pending')} />
        <MetricCard icon={<FaPauseCircle />} label="On Hold" value={counts['on-hold'] || 0} changeColor="var(--indigo)" onClick={() => changeStatus('on-hold')} />
        <MetricCard icon={<FaCheckCircle />} label="Completed" value={counts.completed || 0} changeColor="var(--green)" onClick={() => changeStatus('completed')} />
        <MetricCard icon={<FaTools />} label="All Requests" value={total} changeColor="var(--blue)" onClick={() => changeStatus('All')} />
      </div>
      <div className="crm-card service-list-card">
        <div className="dashboard-table-filters service-list-filters">
          <div className="dashboard-search"><input className="crm-input" aria-label="Search service requests" placeholder="Search request, customer, phone or issue..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></div>
          <select className="crm-input service-status-filter" aria-label="Service status" value={status} onChange={event => changeStatus(event.target.value)}>{Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="All">All</option></select>
          {(search || status !== 'pending') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); changeStatus('pending') }}>Reset</button>}
          <span className="service-muted service-filter-count">{pagination.total} requests</span>
        </div>
        {error ? <div role="alert" className="service-error">{error}<button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>Retry</button></div> : loading ? <Spinner /> : !requests.length ? <EmptyState icon={<FaTools />} title="No service requests found" subtitle={search ? 'Try another search.' : status === 'pending' ? 'Create a new request or check another status.' : 'Choose another status to see requests.'} /> : (
          <div className="crm-table-wrap compact-table-wrap">
            <table className="crm-table compact-dashboard-table service-requests-table">
              <thead><tr>{['Customer', 'Issue', 'Assigned / Visit', 'Status', 'Action'].map(label => <th key={label}>{label}</th>)}</tr></thead>
              <tbody>{requests.map(request => <tr key={request._id}>
                <td><strong>{request.customerName}</strong><div className="compact-secondary">{request.contact}</div><div className="compact-secondary">{request.requestNo}{request.city ? ` / ${request.city}` : ''}</div></td>
                <td>{request.issue}</td>
                <td><div>{request.assignedTo?.name || '-'}</div><div className="compact-secondary">{request.visitDate ? formatFollowUpDate(request.visitDate) : 'No visit scheduled'}</div></td>
                <td>{listStatus(request)}</td><td>{rowActions(request)}</td>
              </tr>)}</tbody>
            </table>
            <div className="crm-mobile-cards">{requests.map(request => <article className="crm-mobile-card" key={request._id}>
              <div className="dashboard-split-row"><div><strong>{request.customerName}</strong><div className="compact-secondary">{request.contact}</div></div>{listStatus(request)}</div>
              <div className="compact-secondary">{request.requestNo}{request.city ? ` / ${request.city}` : ''}</div><p className="service-card-issue">{request.issue}</p>
              <div className="crm-mobile-row"><span className="crm-mobile-label">Assigned</span><span>{request.assignedTo?.name || '-'}</span></div>
              <div className="crm-mobile-row"><span className="crm-mobile-label">Visit</span><span>{request.visitDate ? formatFollowUpDate(request.visitDate) : 'Not scheduled'}</span></div>
              <div className="service-mobile-action">{rowActions(request)}</div>
            </article>)}</div>
          </div>
        )}
        {!loading && !error && pagination.total > 0 && <footer className="service-pagination"><span>Showing {(pagination.page - 1) * 25 + 1}-{Math.min(pagination.page * 25, pagination.total)} of {pagination.total}</span><div><button type="button" className="btn btn-ghost btn-sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button type="button" className="btn btn-ghost btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></footer>}
      </div>
      {showCreate && <ServiceRequestForm user={user} onClose={() => setShowCreate(false)} onCreated={request => { setShowCreate(false); changeStatus('pending'); setSearch(''); refresh(); setSelectedId(request._id) }} />}
      {editingRequest && <ServiceRequestForm user={user} request={editingRequest} onClose={() => setEditingRequest(null)} onSaved={() => { setEditingRequest(null); refresh() }} />}
      {selectedId && <ServiceRequestDetails requestId={selectedId} onClose={() => setSelectedId('')} onChanged={refresh} />}
    </div>
  )
}
