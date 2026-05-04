import { useState, useEffect } from 'react'
import { FaClipboardList } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { PageHeader } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'

export function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const { user } = useAuthStore()
  const canDelete = ['Admin', 'Manager'].includes(user?.role)

  const fetch = () => {
    leadsAPI.getAll({ sort: 'ivrs-asc' }).then(r => setLeads(r.data.data)).finally(() => setLoading(false))
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

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <PageHeader icon={<FaClipboardList />} title="All Leads" subtitle={`${leads.length} total leads in the system`} />
      <div className="crm-card">
        <LeadsTable leads={leads} loading={loading} onView={setSelected} onDelete={canDelete ? deleteLead : undefined} />
      </div>
      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetch} currentUser={user} />}
    </div>
  )
}

export default LeadsPage
