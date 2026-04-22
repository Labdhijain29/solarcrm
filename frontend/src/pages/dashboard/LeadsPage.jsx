import { useState, useEffect } from 'react'
import { FaClipboardList } from 'react-icons/fa'
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

  const fetch = () => {
    leadsAPI.getAll().then(r => setLeads(r.data.data)).finally(() => setLoading(false))
  }
  useEffect(fetch, [])

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <PageHeader icon={<FaClipboardList />} title="All Leads" subtitle={`${leads.length} total leads in the system`} />
      <div className="crm-card">
        <LeadsTable leads={leads} loading={loading} onView={setSelected} />
      </div>
      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onUpdated={fetch} currentUser={user} />}
    </div>
  )
}

export default LeadsPage
