import { useEffect, useMemo, useState } from 'react'
import { FaBan, FaCalendarAlt, FaClipboardList, FaExclamationTriangle, FaLayerGroup } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { EmptyState, MetricCard, PageHeader, StageBadge } from '../../components/common'
import LeadsTable from '../../components/dashboard/LeadsTable'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'
import { STAGES, formatDate } from '../../utils/constants'

const getRejectedHistory = (lead) => {
  return [...(lead.history || [])].reverse().find((item) => item.action === 'Rejected')
}

const getRejectedAt = (lead) => {
  const rejectedHistory = getRejectedHistory(lead)
  return rejectedHistory?.timestamp || lead.updatedAt || lead.createdAt
}

export default function RejectedLeadsPage() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const { user } = useAuthStore()
  const canDelete = ['Admin', 'Manager'].includes(user?.role)

  const fetchRejectedLeads = () => {
    setLoading(true)
    leadsAPI
      .getAll({ status: 'rejected', limit: 1000, sort: 'latest' })
      .then((response) => setLeads(response.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(fetchRejectedLeads, [])

  const deleteLead = async (lead) => {
    if (!canDelete) return
    if (!window.confirm(`Delete rejected lead "${lead.name}" permanently?`)) return
    try {
      await leadsAPI.delete(lead._id)
      toast.success('Rejected lead deleted')
      if (selected?._id === lead._id) setSelected(null)
      fetchRejectedLeads()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete lead')
    }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = leads.filter((lead) => {
      const rejectedAt = new Date(getRejectedAt(lead))
      return rejectedAt.getMonth() === now.getMonth() && rejectedAt.getFullYear() === now.getFullYear()
    }).length

    const byStage = STAGES.map((stage) => ({
      stage,
      count: leads.filter((lead) => lead.currentStage === stage).length,
    })).filter((item) => item.count > 0)

    const latest = [...leads].sort((a, b) => new Date(getRejectedAt(b)) - new Date(getRejectedAt(a)))[0]

    return {
      total: leads.length,
      thisMonth,
      stages: byStage.length,
      latest,
      byStage,
    }
  }, [leads])

  const latestRejectedHistory = stats.latest ? getRejectedHistory(stats.latest) : null

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaBan />}
        title="Rejected Leads Dashboard"
        subtitle={`${stats.total} rejected leads with stage, reason and customer details`}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaBan />} label="Rejected Leads" value={stats.total} changeColor="var(--red)" />
        <MetricCard icon={<FaCalendarAlt />} label="This Month" value={stats.thisMonth} changeColor="var(--sun)" />
        <MetricCard icon={<FaLayerGroup />} label="Rejected Stages" value={stats.stages} changeColor="var(--blue)" />
        <MetricCard
          icon={<FaClipboardList />}
          label="Latest Rejection"
          value={stats.latest ? formatDate(getRejectedAt(stats.latest)) : '-'}
          change={stats.latest?.name}
          changeColor="var(--red)"
        />
      </div>

      <div className="dashboard-grid-two" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="crm-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Rejected by Stage</h3>
          {stats.byStage.length === 0 ? (
            <EmptyState icon={<FaExclamationTriangle />} title="No rejected stages yet" subtitle="Rejected leads will be grouped here by their last workflow stage" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {stats.byStage.map((item) => (
                <div key={item.stage} className="dashboard-split-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <StageBadge stage={item.stage} />
                  <strong style={{ color: 'var(--text)' }}>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="crm-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Latest Rejection</h3>
          {stats.latest ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="dashboard-split-row">
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Customer</span>
                <strong>{stats.latest.name}</strong>
              </div>
              <div className="dashboard-split-row">
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Stage</span>
                <StageBadge stage={stats.latest.currentStage} />
              </div>
              <div className="dashboard-split-row">
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Rejected By</span>
                <strong>{latestRejectedHistory?.performedByName || '-'}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>Reason</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{latestRejectedHistory?.note || 'No reason added'}</div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<FaBan />} title="No rejected leads" subtitle="When a lead is rejected, the latest reason will appear here" />
          )}
        </div>
      </div>

      <div className="crm-card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Rejected Leads ({stats.total})</h3>
        <LeadsTable leads={leads} loading={loading} onView={setSelected} onDelete={canDelete ? deleteLead : undefined} onLeadUpdated={fetchRejectedLeads} />
      </div>

      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdated={fetchRejectedLeads}
          currentUser={user}
        />
      )}
    </div>
  )
}
