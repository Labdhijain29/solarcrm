import { useState, useEffect } from 'react'
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

export function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editingLeadId, setEditingLeadId] = useState('')
  const { user } = useAuthStore()
  const canDelete = ['Admin', 'Manager'].includes(user?.role)

  const fetch = () => {
    leadsAPI.getAll({ sort: 'latest' }).then(r => setLeads(r.data.data)).finally(() => setLoading(false))
  }
  useEffect(fetch, [])

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
      <PageHeader icon={<FaClipboardList />} title="All Leads" subtitle={`${leads.length} total leads in the system`} />
      <div className="crm-card">
        <LeadsTable leads={leads} loading={loading} onView={viewLead} onDelete={canDelete ? deleteLead : undefined} extraActions={leadRowActions} onLeadUpdated={fetch} />
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
