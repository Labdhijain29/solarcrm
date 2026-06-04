import { useState, useEffect, useRef } from 'react'
import { FaClipboardList, FaEdit } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { PageHeader } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'

const canEditBeforeApproval = (lead, role) => (
  ['Admin', 'Manager', 'Sales Executive', 'Sales Manager'].includes(role) &&
  lead?.currentStage === 'Lead' &&
  lead?.status === 'active'
)
const LEADS_PAGE_SIZE = 25

export function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [leadPagination, setLeadPagination] = useState({ page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
  const [leadQuery, setLeadQuery] = useState({ page: 1, sort: 'latest' })
  const [selected, setSelected] = useState(null)
  const [editingLeadId, setEditingLeadId] = useState('')
  const leadRequestId = useRef(0)
  const { user } = useAuthStore()
  const canDelete = ['Admin', 'Manager'].includes(user?.role)

  const fetch = (query = leadQuery) => {
    const requestId = leadRequestId.current + 1
    leadRequestId.current = requestId
    setLoading(true)
    leadsAPI.getAll({ limit: LEADS_PAGE_SIZE, ...query })
      .then((response) => {
        if (requestId !== leadRequestId.current) return
        setLeads(response.data.data || [])
        setLeadPagination(response.data.pagination || { page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
      })
      .catch((error) => {
        if (requestId !== leadRequestId.current) return
        console.error(error)
        setLeads([])
        setLeadPagination({ page: 1, limit: LEADS_PAGE_SIZE, total: 0, pages: 1 })
      })
      .finally(() => {
        if (requestId === leadRequestId.current) setLoading(false)
      })
  }

  useEffect(() => {
    fetch(leadQuery)
  }, [leadQuery])

  const handleLeadQueryChange = (query) => {
    setLeadQuery({ page: 1, sort: 'latest', ...query })
  }

  const deleteLead = async (lead) => {
    if (!canDelete) return
    if (!window.confirm(`Delete lead "${lead.name}" permanently?`)) return
    try {
      await leadsAPI.delete(lead._id)
      toast.success('Lead deleted')
      if (selected?._id === lead._id) setSelected(null)
      fetch()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete lead')
    }
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
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <PageHeader icon={<FaClipboardList />} title="All Leads" subtitle={`${leadPagination.total || leads.length} total leads in the system`} />
      <div className="crm-card">
        <LeadsTable
          leads={leads}
          loading={loading}
          onView={viewLead}
          onDelete={canDelete ? deleteLead : undefined}
          extraActions={leadRowActions}
          pagination={leadPagination}
          onQueryChange={handleLeadQueryChange}
          onLeadUpdated={fetch}
        />
      </div>
      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => {
            setSelected(null)
            setEditingLeadId('')
          }}
          onUpdated={fetch}
          currentUser={user}
          startEditing={editingLeadId === selected._id}
        />
      )}
    </div>
  )
}

export default LeadsPage
