import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, LeadAvatar, PipelineBar, StageBadge, StatusBadge } from '../common'
import { SOURCES, STAGES } from '../../utils/constants'

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
const formatLeadDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

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
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [srcFilter, setSrc] = useState('All')
  const [statusFilter, setStatus] = useState('All')
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
      ...(next.status && next.status !== 'All' ? { status: next.status } : {}),
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
    (showStatusFilter && statusFilter !== 'All') ||
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
    setStatus('All')
    setStage('All')
    setSortBy(defaultSort)
    updateServerQuery({ search: '', source: 'All', status: 'All', stage: 'All', sort: defaultSort, page: 1 })
  }

  const handleReassigned = (updatedLead) => {
    if (updatedLead?._id && (stageFilter === 'All' || updatedLead.currentStage !== stageFilter)) {
      setHiddenLeadIds((prev) => [...new Set([...prev, updatedLead._id])])
    }
    onLeadUpdated?.(updatedLead)
    if (serverMode) updateServerQuery({})
  }

  return (
    <div>
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
          <select className="crm-input" style={{ width:'auto' }} value={statusFilter} onChange={(e) => {
            setStatus(e.target.value)
            updateServerQuery({ status: e.target.value, page: 1 })
          }}>
            {['All', 'active', 'completed', 'rejected', 'on-hold'].map((item) => <option key={item}>{item}</option>)}
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

      <div className="crm-table-wrap">
        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Loading leads...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={leads.length === 0 ? 'No leads found' : 'No leads match these filters'}
            subtitle={hasActiveFilters ? 'Change or reset the filters to see leads again' : 'Leads will appear here once they are added'}
          />
        ) : (
          <>
            <table className="crm-table">
              <thead>
                <tr>
                  {['ID', 'Date', 'Customer', 'City', 'Source', 'IVRS No.', 'Branch', 'Generated By / Through', 'kW', 'Stage', 'Status', 'Progress', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead._id || lead.id}>
                    <td><span style={{ fontFamily:'monospace', fontSize:11, color:'var(--muted)' }}>{getLeadDisplayId(lead)}</span></td>
                    <td style={{ fontSize:12, whiteSpace:'nowrap' }}>{formatLeadDate(lead.createdAt)}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <LeadAvatar name={lead.name} size={32} />
                        <div>
                          <div style={{ fontSize:13, fontWeight:500 }}>{lead.name}</div>
                          <div style={{ fontSize:11, color:'var(--dim)' }}>{lead.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray">{lead.city || '-'}</span></td>
                    <td><span className="badge badge-blue">{lead.source}</span></td>
                    <td style={{ fontSize:12 }}>{lead.ivrsNo || '-'}</td>
                    <td style={{ fontSize:12 }}>{lead.branch || lead.salesExecutiveData?.branch || '-'}</td>
                    <td style={{ fontSize:12 }}>
                      <div style={{ fontWeight:600 }}>{getGeneratedByName(lead) || '-'}</div>
                      <div style={{ color:'var(--muted)', fontSize:11 }}>{lead.generatedThrough || '-'}</div>
                    </td>
                    <td><span style={{ fontWeight:600, color:'var(--sun)' }}>{lead.capacity}</span></td>
                    <td><StageBadge stage={lead.currentStage} /></td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td style={{ minWidth:120 }}><PipelineBar lead={lead} /></td>
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
                    <StatusBadge status={lead.status} />
                  </div>

                  {[
                    ['City', lead.city || '-'],
                    ['ID', getLeadDisplayId(lead)],
                    ['Date', formatLeadDate(lead.createdAt)],
                    ['Source', lead.source || '-'],
                    ['IVRS No.', lead.ivrsNo || '-'],
                    ['Branch', lead.branch || lead.salesExecutiveData?.branch || '-'],
                    ['Generated By', getGeneratedByName(lead) || '-'],
                    ['By / Through', lead.generatedThrough || '-'],
                    ['Capacity', lead.capacity || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="crm-mobile-row">
                      <span className="crm-mobile-label">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}

                  <div style={{ padding:'8px 0' }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Stage</div>
                    <StageBadge stage={lead.currentStage} />
                  </div>

                  <div style={{ padding:'8px 0' }}>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Progress</div>
                    <PipelineBar lead={lead} />
                  </div>

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
