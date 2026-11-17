import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaArrowRight, FaTimes } from 'react-icons/fa'
import { leadsAPI } from '../../services/api'
import { Spinner } from '../common'
import LeadModal from './LeadModal'
import { STAGES, stageColor } from '../../utils/constants'

const PAGE_SIZE = 25
const initialFilters = { search: '', city: '', assignedTo: '', status: 'active', sort: 'oldest' }

function timeAtStage(lead) {
  if (lead.status === 'completed') return 'Completed'
  if (lead.status === 'rejected') return 'Rejected'
  const entered = new Date(lead.stageEnteredAt).getTime()
  if (!Number.isFinite(entered)) return 'Date unavailable'
  const days = Math.max(0, Math.floor((Date.now() - entered) / 86400000))
  return days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`
}

function PipelineFilters({ value, onChange, options }) {
  const update = event => onChange({ ...value, [event.target.name]: event.target.value })
  return (
    <div className="pipeline-filters">
      <input className="crm-input pipeline-search" name="search" aria-label="Search pipeline" placeholder="Search name, phone, IVRS or ID..." value={value.search} onChange={update} />
      <select className="crm-input" name="city" aria-label="Filter pipeline by city" value={value.city} onChange={update}>
        <option value="">All cities</option>{options.cities.map(city => <option key={city}>{city}</option>)}
      </select>
      <select className="crm-input" name="assignedTo" aria-label="Filter pipeline by executive" value={value.assignedTo} onChange={update}>
        <option value="">All executives</option>{options.executives.map(user => <option key={user._id} value={user._id}>{user.name}</option>)}
      </select>
      <select className="crm-input" name="status" aria-label="Filter pipeline by status" value={value.status} onChange={update}>
        <option value="active">Active</option><option value="on-hold">On Hold</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="All">All</option>
      </select>
      <select className="crm-input" name="sort" aria-label="Sort pipeline by time at stage" value={value.sort} onChange={update}>
        <option value="oldest">Oldest first</option><option value="latest">Newest first</option>
      </select>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...initialFilters })}>Reset</button>
    </div>
  )
}

export default function PipelineBoard({ refreshKey = 0 }) {
  const [filters, setFilters] = useState(initialFilters)
  const [stages, setStages] = useState([])
  const [options, setOptions] = useState({ cities: [], executives: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [activeStage, setActiveStage] = useState('')
  const [mobileStage, setMobileStage] = useState(STAGES[0])
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 })
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [jump, setJump] = useState('1')
  const [selectedLead, setSelectedLead] = useState(null)
  const [openingLead, setOpeningLead] = useState('')
  const [leadError, setLeadError] = useState('')
  const panelRef = useRef(null)
  const openerRef = useRef(null)
  const detailRequest = useRef(0)

  const changeFilters = next => { setFilters(next); setPage(1) }
  useEffect(() => {
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      leadsAPI.getPipeline(filters).then(response => {
        if (!alive) return
        setStages(response.data.data || [])
        setOptions(response.data.options || { cities: [], executives: [] })
        setError('')
      }).catch(error => {
        if (alive) setError(error.response?.data?.message || 'Could not load pipeline.')
      }).finally(() => { if (alive) setLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [filters, refreshKey, revision])

  useEffect(() => {
    if (!activeStage) return
    let alive = true
    setPageLoading(true)
    const timer = setTimeout(() => {
      leadsAPI.getPipeline({ ...filters, stage: activeStage, page }).then(response => {
        if (!alive) return
        setRows(response.data.data || [])
        setPagination(response.data.pagination)
        setJump(String(response.data.pagination.page))
        setPageError('')
        if (response.data.pagination.page !== page) setPage(response.data.pagination.page)
      }).catch(error => {
        if (alive) setPageError(error.response?.data?.message || 'Could not load leads.')
      }).finally(() => { if (alive) setPageLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [filters, activeStage, page, refreshKey, revision])

  useEffect(() => {
    if (!activeStage || selectedLead) return
    const panel = panelRef.current
    panel?.querySelector('input')?.focus()
    const handleKey = event => {
      if (!panel?.contains(event.target)) return
      if (event.key === 'Escape') { event.preventDefault(); closeStage(); return }
      if (event.key !== 'Tab') return
      const controls = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    panel?.addEventListener('keydown', handleKey)
    return () => panel?.removeEventListener('keydown', handleKey)
  }, [activeStage, selectedLead])

  useEffect(() => {
    if (!activeStage) { openerRef.current?.focus(); return }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [activeStage])
  useEffect(() => () => { detailRequest.current += 1 }, [])

  const openStage = (stage, event) => {
    openerRef.current = event.currentTarget
    setActiveStage(stage); setPage(1); setRows([]); setPageError(''); setLeadError('')
  }
  const openLead = async lead => {
    const request = ++detailRequest.current
    setOpeningLead(lead._id); setLeadError('')
    try {
      const response = await leadsAPI.getOne(lead._id)
      if (request === detailRequest.current) setSelectedLead(response.data.data)
    } catch (error) {
      if (request === detailRequest.current) setLeadError(error.response?.data?.message || 'Could not open lead.')
    } finally { if (request === detailRequest.current) setOpeningLead('') }
  }
  const closeStage = () => { detailRequest.current += 1; setOpeningLead(''); setActiveStage('') }
  const pageStart = pagination.total ? (pagination.page - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(pagination.page * PAGE_SIZE, pagination.total)

  return (
    <section className="pipeline-board" aria-label="Lead pipeline">
      <PipelineFilters value={filters} onChange={changeFilters} options={options} />
      <div className="pipeline-mobile-stage">
        <label htmlFor="pipeline-mobile-stage">Stage</label>
        <select id="pipeline-mobile-stage" className="crm-input" value={mobileStage} onChange={event => setMobileStage(event.target.value)}>
          {STAGES.map(stage => <option key={stage}>{stage}</option>)}
        </select>
      </div>
      {leadError && <p role="alert" className="pipeline-error">{leadError}</p>}
      {error ? <div className="pipeline-error" role="alert">{error} <button className="btn btn-ghost btn-sm" onClick={() => setRevision(value => value + 1)}>Retry</button></div> : loading ? <Spinner /> : (
        <div className="pipeline-stage-grid">
          {stages.map(({ stage, total, leads }) => (
            <section className={`kanban-col pipeline-stage ${stage === mobileStage ? 'pipeline-stage-selected' : ''}`} key={stage}>
              <header className="pipeline-stage-heading"><h3 style={{ color: stageColor(stage) }}>{stage}</h3><span>{total.toLocaleString()}</span></header>
              <div className="pipeline-stage-cards">
                {leads.map(lead => (
                  <button type="button" className="kanban-card pipeline-lead-card" disabled={Boolean(openingLead)} onClick={() => openLead(lead)} key={lead._id}>
                    <strong>{lead.name}</strong><span>{[lead.capacity, lead.city].filter(Boolean).join(' / ')}</span>
                    <small className="pipeline-stage-time"><span>{['completed', 'rejected'].includes(lead.status) ? 'Status' : 'Time in stage'}</span><span>{openingLead === lead._id ? 'Opening...' : timeAtStage(lead)}</span></small>
                  </button>
                ))}
                {!total && <p className="pipeline-empty">No matching leads</p>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm pipeline-view-all" disabled={!total} onClick={event => openStage(stage, event)}>View all {total.toLocaleString()} <FaArrowRight aria-hidden="true" /></button>
            </section>
          ))}
        </div>
      )}
      {activeStage && createPortal(
        <div className="pipeline-panel-backdrop" onClick={event => { if (event.target === event.currentTarget && !selectedLead) closeStage() }}>
          <section className="pipeline-panel" role="dialog" aria-modal="true" aria-labelledby="pipeline-panel-title" ref={panelRef}>
            <header className="pipeline-panel-heading"><h2 id="pipeline-panel-title">{activeStage} <span>{!pageLoading && !pageError ? ` / ${pagination.total.toLocaleString()} leads` : ''}</span></h2><button type="button" className="btn btn-ghost btn-sm" aria-label="Close stage list" onClick={closeStage}><FaTimes /></button></header>
            <PipelineFilters value={filters} onChange={changeFilters} options={options} />
            {leadError && <p role="alert" className="pipeline-error">{leadError}</p>}
            <div className="pipeline-panel-results" aria-busy={pageLoading}>
              {pageError ? <div role="alert" className="pipeline-error">{pageError} <button className="btn btn-ghost btn-sm" onClick={() => setRevision(value => value + 1)}>Retry</button></div> : pageLoading ? <Spinner /> : !rows.length ? <p className="pipeline-empty">No leads match these filters.</p> : (
                <div className="pipeline-result-list">
                  <div className="pipeline-result-heading"><span>Customer</span><span>City</span><span>Executive</span><span>Time in stage</span><span /></div>
                  {rows.map(lead => (
                    <button type="button" className="pipeline-result-row" key={lead._id} disabled={Boolean(openingLead)} onClick={() => openLead(lead)}>
                      <span><strong>{lead.name}</strong><small>{lead.phone || lead.ivrsNo || '-'}</small></span>
                      <span><small className="pipeline-mobile-label">City</small>{lead.city || '-'}</span>
                      <span><small className="pipeline-mobile-label">Executive</small>{lead.assignedTo?.name || 'Unassigned'}</span>
                      <span><small className="pipeline-mobile-label">Time in stage</small>{timeAtStage(lead)}{lead.status === 'on-hold' && <small>On Hold</small>}</span>
                      <span>{openingLead === lead._id ? 'Opening...' : <FaArrowRight aria-hidden="true" />}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <footer className="pipeline-pagination">
              <span>{pageLoading ? 'Loading...' : pageError ? 'Leads unavailable' : `Showing ${pageStart}-${pageEnd} of ${pagination.total.toLocaleString()}`}</span>
              <div><button className="btn btn-ghost btn-sm" disabled={pageLoading || Boolean(pageError) || pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button>
                <form onSubmit={event => { event.preventDefault(); setPage(Math.max(1, Math.min(pagination.pages, Number(jump) || 1))) }}>
                  <label htmlFor="pipeline-page">Page</label><input id="pipeline-page" className="crm-input" type="number" min="1" max={pagination.pages} value={jump} onChange={event => setJump(event.target.value)} disabled={pageLoading} /><span>of {pagination.pages}</span><button className="btn btn-ghost btn-sm" disabled={pageLoading || Boolean(pageError)}>Go</button>
                </form>
                <button className="btn btn-ghost btn-sm" disabled={pageLoading || Boolean(pageError) || pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next</button></div>
            </footer>
          </section>
        </div>, document.body
      )}
      {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={() => setRevision(value => value + 1)} />}
    </section>
  )
}
