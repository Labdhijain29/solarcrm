import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, LeadAvatar, StageBadge, StatusBadge } from '../common'
import { SOURCES, STAGES } from '../../utils/constants'
import LeadStatusToggle, { HOLD_STATUS_OPTIONS } from './LeadStatusToggle'

const compareIvrs = (a, b, direction = 'asc') => {
  const left = String(a.ivrsNo || '')
  const right = String(b.ivrsNo || '')
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'desc' ? -result : result
}

const getLeadDisplayId = (lead) => lead.leadId || lead._id?.slice(-6) || lead.id || '-'

const getPaginationItems = (page = 1, pages = 1) => {
  const currentPage = Number(page) || 1
  const totalPages = Number(pages) || 1
  const items = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b)
  const uniqueItems = [...new Set(items)]

  return uniqueItems.reduce((result, item, index) => {
    if (index > 0 && item - uniqueItems[index - 1] > 1) result.push('ellipsis')
    result.push(item)
    return result
  }, [])
}

const getGeneratedByName = (lead) => {
  if (lead.salesExecutiveAssignee?.name) return lead.salesExecutiveAssignee.name
  if (lead.salesExecutiveData?.executiveName) return lead.salesExecutiveData.executiveName
  if (lead.createdBy?.name) return lead.createdBy.name
  if (typeof lead.createdBy === 'string') return lead.createdBy
  return ''
}

export default function LeadsTable({
  leads = [],
  loading,
  onView,
  onDelete,
  extraActions,
  defaultSort = 'latest',
  pagination,
  onQueryChange,
  onLeadUpdated,
  showStatusFilter = true,
  showStageFilter = true,
  showStageColumn = true,
  enableHold = false,
  defaultStatus = 'All',
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [srcFilter, setSrc] = useState('All')
  const [statusFilter, setStatus] = useState(defaultStatus)
  const [stageFilter, setStage] = useState('All')
  const [sortBy, setSortBy] = useState(defaultSort)
  const [hiddenLeadIds, setHiddenLeadIds] = useState([])
  const searchDebounceReadyRef = useRef(false)
  const skipNextSearchDebounceRef = useRef(false)
  const serverMode = typeof onQueryChange === 'function'

  const toServerQuery = (overrides = {}) => {
    const next = {
      search,
      source: srcFilter,
      status: statusFilter,
      stage: stageFilter,
      sort: sortBy,
      page: 1,
      ...overrides,
    }

    return {
      page: next.page,
      sort: next.sort,
      ...(String(next.search || '').trim() ? { search: String(next.search).trim() } : {}),
      ...(next.source && next.source !== 'All' ? { source: next.source } : {}),
      ...(next.status && next.status !== 'All' ? { status: next.status } : enableHold ? { status: 'active,on-hold' } : {}),
      ...(next.stage && next.stage !== 'All' ? { stage: next.stage } : {}),
    }
  }

  const updateServerQuery = (overrides) => {
    if (serverMode) onQueryChange(toServerQuery(overrides))
  }

  useEffect(() => {
    if (!serverMode) return
    if (!searchDebounceReadyRef.current) {
      searchDebounceReadyRef.current = true
      return
    }
    if (skipNextSearchDebounceRef.current) {
      skipNextSearchDebounceRef.current = false
      return
    }

    const timeoutId = setTimeout(() => {
      updateServerQuery({ search, page: 1 })
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [search])

  const hasActiveFilters =
    search.trim() !== '' ||
    srcFilter !== 'All' ||
    (showStatusFilter && statusFilter !== defaultStatus) ||
    (showStageFilter && stageFilter !== 'All') ||
    sortBy !== defaultSort

  const visibleLeads = leads.filter((lead) => !hiddenLeadIds.includes(lead._id || lead.id))
  const filtered = serverMode ? visibleLeads : visibleLeads
    .filter((lead) => {
      const q = search.toLowerCase()
      if (
        q &&
        !lead.name?.toLowerCase().includes(q) &&
        !lead.phone?.includes(q) &&
        !lead.city?.toLowerCase().includes(q) &&
        !lead.branch?.toLowerCase().includes(q) &&
        !lead.salesExecutiveData?.branch?.toLowerCase().includes(q) &&
        !lead.generatedThrough?.toLowerCase().includes(q) &&
        !getGeneratedByName(lead).toLowerCase().includes(q) &&
        !String(lead.leadId || '').includes(q) &&
        !lead.ivrsNo?.includes(q)
      ) return false
      if (srcFilter !== 'All' && lead.source !== srcFilter) return false
      if (statusFilter !== 'All' && lead.status !== statusFilter) return false
      if (enableHold && !['active', 'on-hold'].includes(lead.status)) return false
      if (stageFilter !== 'All' && lead.currentStage !== stageFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'ivrs-asc') return compareIvrs(a, b, 'asc')
      if (sortBy === 'ivrs-desc') return compareIvrs(a, b, 'desc')
      if (sortBy === 'id-asc') return Number(a.leadId || 0) - Number(b.leadId || 0)
      if (sortBy === 'id-desc') return Number(b.leadId || 0) - Number(a.leadId || 0)
      if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })

  const handleView = (lead) => {
    if (onView) {
      onView(lead)
      return
    }
    navigate(`/dashboard/leads/${lead._id}`)
  }

  const resetFilters = () => {
    skipNextSearchDebounceRef.current = search !== ''
    setSearch('')
    setSrc('All')
    setStatus(defaultStatus)
    setStage('All')
    setSortBy(defaultSort)
    updateServerQuery({ search: '', source: 'All', status: defaultStatus, stage: 'All', sort: defaultSort, page: 1 })
  }

  const handleReassigned = (updatedLead) => {
    if (updatedLead?._id && (stageFilter === 'All' || updatedLead.currentStage !== stageFilter)) {
      setHiddenLeadIds((prev) => [...new Set([...prev, updatedLead._id])])
    }
    onLeadUpdated?.(updatedLead)
    if (serverMode) updateServerQuery({})
  }

  return (
    <div className="compact-list-region">
      <div className="dashboard-table-filters">
        <div className="dashboard-search">
          <input
            className="crm-input"
            placeholder="Search ID, name, phone, city, branch, IVRS..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
          />
        </div>
        <select className="crm-input" style={{ width:'auto' }} value={srcFilter} onChange={(e) => {
          setSrc(e.target.value)
          updateServerQuery({ source: e.target.value, page: 1 })
        }}>
          {['All', ...SOURCES].map((item) => <option key={item}>{item}</option>)}
        </select>
        {showStageFilter && (
          <select className="crm-input" style={{ width:'auto' }} value={stageFilter} onChange={(e) => {
            setStage(e.target.value)
            updateServerQuery({ stage: e.target.value, page: 1 })
          }}>
            {['All', ...STAGES].map((item) => <option key={item}>{item}</option>)}
          </select>
        )}
        {showStatusFilter && (
          <select className="crm-input" aria-label="Lead status filter" style={{ width:'auto' }} value={statusFilter} onChange={(e) => {
            setStatus(e.target.value)
            updateServerQuery({ status: e.target.value, page: 1 })
          }}>
            {enableHold ? HOLD_STATUS_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>) : ['All', 'active', 'completed', 'rejected', 'on-hold'].map((item) => <option key={item}>{item}</option>)}
          </select>
        )}
        <select className="crm-input" style={{ width:'auto' }} value={sortBy} onChange={(e) => {
          setSortBy(e.target.value)
          updateServerQuery({ sort: e.target.value, page: 1 })
        }}>
          <option value="latest">Date Newest</option>
          <option value="oldest">Date Oldest</option>
          <option value="id-asc">ID 0-9</option>
          <option value="id-desc">ID 9-0</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="ivrs-asc">IVRS 0-9</option>
          <option value="ivrs-desc">IVRS 9-0</option>
        </select>
        <span style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>
          {serverMode && pagination ? `${pagination.total} leads` : `${filtered.length} leads`}
        </span>
        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </div>

      <div className="crm-table-wrap compact-table-wrap">
        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Loading leads...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={leads.length === 0 ? 'No leads found' : 'No leads match these filters'}
            subtitle={hasActiveFilters ? 'Change or reset the filters to see leads again' : 'Leads will appear here once they are added'}
          />
        ) : (
          <>
            <table className="crm-table compact-dashboard-table">
              <thead>
                <tr>
                  {['Customer', 'Location', 'Project', ...(showStageColumn ? ['Stage'] : []), 'Status', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead._id || lead.id}>
                    <td>
                      <div className="compact-customer">
                        <LeadAvatar name={lead.name} size={32} />
                        <div className="compact-cell-text">
                          <strong>{lead.name}</strong>
                          <div className="compact-secondary">{lead.phone || '-'}</div>
                          <div className="compact-secondary">ID: {getLeadDisplayId(lead)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{lead.city || '-'}</div>
                      <div className="compact-secondary">Branch: {lead.branch || lead.salesExecutiveData?.branch || '-'}</div>
                    </td>
                    <td>
                      <div>IVRS: {lead.ivrsNo || '-'}</div>
                      <div className="compact-secondary">{lead.capacity || '-'}</div>
                    </td>
                    {showStageColumn && <td><StageBadge stage={lead.currentStage} /></td>}
                    <td>{enableHold ? <LeadStatusToggle lead={lead} onUpdated={onLeadUpdated} /> : <StatusBadge status={lead.status} />}</td>
                    <td>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleView(lead)}>View</button>
                        {onDelete && <button className="btn btn-danger btn-sm" onClick={() => onDelete(lead)}>Delete</button>}
                        {extraActions && extraActions(lead)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="crm-mobile-cards">
              {filtered.map((lead) => (
                <div key={lead._id || lead.id} className="crm-mobile-card">
                  <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <LeadAvatar name={lead.name} size={34} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:600 }}>{lead.name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>{lead.phone}</div>
                      </div>
                    </div>
                    {enableHold ? <LeadStatusToggle lead={lead} onUpdated={onLeadUpdated} /> : <StatusBadge status={lead.status} />}
                  </div>

                  {[
                    ['ID', getLeadDisplayId(lead)],
                    ['Location', `${lead.city || '-'} / ${lead.branch || lead.salesExecutiveData?.branch || '-'}`],
                    ['IVRS / kW', `${lead.ivrsNo || '-'} / ${lead.capacity || '-'}`],
                  ].map(([label, value]) => (
                    <div key={label} className="crm-mobile-row">
                      <span className="crm-mobile-label">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}

                  {showStageColumn && <div style={{ padding:'8px 0' }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Stage</div>
                    <StageBadge stage={lead.currentStage} />
                  </div>}

                  <div className="dashboard-inline-actions" style={{ marginTop:10 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleView(lead)}>View</button>
                    {onDelete && <button className="btn btn-danger btn-sm" onClick={() => onDelete(lead)}>Delete</button>}
                    {extraActions && extraActions(lead)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {serverMode && pagination && pagination.pages > 1 && (
        <div className="lead-pagination">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => updateServerQuery({ page: pagination.page - 1 })}
          >
            Previous
          </button>
          <div className="lead-pagination-pages">
            {getPaginationItems(pagination.page, pagination.pages).map((item, index) => (
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="lead-pagination-ellipsis">...</span>
              ) : (
                <button
                  key={item}
                  className={`btn btn-sm ${pagination.page === item ? 'btn-primary' : 'btn-ghost'}`}
                  type="button"
                  disabled={pagination.page === item}
                  onClick={() => updateServerQuery({ page: item })}
                >
                  {item}
                </button>
              )
            ))}
          </div>
          <div className="lead-pagination-spacer" />
          <form
            className="lead-pagination-jump"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const requestedPage = Math.min(Math.max(Number(form.get('page')) || pagination.page, 1), pagination.pages)
              updateServerQuery({ page: requestedPage })
            }}
          >
            <span>Page {pagination.page} of {pagination.pages}</span>
            <input className="crm-input" name="page" type="number" min={1} max={pagination.pages} placeholder="Go to" />
            <button className="btn btn-ghost btn-sm" type="submit">Go</button>
          </form>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => updateServerQuery({ page: pagination.page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </div> 
  )
}
