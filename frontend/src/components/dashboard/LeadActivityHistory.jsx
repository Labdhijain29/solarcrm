import { useMemo, useState } from 'react'
import { STAGES } from '../../utils/constants'

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
})
const timestamp = (item) => {
  const value = item.timestamp ? new Date(item.timestamp).getTime() : NaN
  return Number.isFinite(value) ? value : 0
}

export default function LeadActivityHistory({ history = [], currentStage }) {
  const [expanded, setExpanded] = useState({})
  const [showAll, setShowAll] = useState({})
  const groups = useMemo(() => {
    const stages = new Map()
    history.forEach((item, index) => {
      const stage = item.stage || 'Other'
      if (!stages.has(stage)) stages.set(stage, [])
      stages.get(stage).push({ ...item, originalIndex: index })
    })
    return [...stages].map(([stage, items]) => ({
      stage,
      items: items.sort((a, b) => timestamp(b) - timestamp(a) || b.originalIndex - a.originalIndex),
    })).sort((a, b) => {
      const order = stage => STAGES.includes(stage) ? STAGES.indexOf(stage) : STAGES.length
      return order(a.stage) - order(b.stage)
    })
  }, [history])
  const defaultStage = groups.some(group => group.stage === currentStage)
    ? currentStage
    : groups.reduce((latest, group) => timestamp(group.items[0]) > timestamp(latest?.items[0] || {}) ? group : latest, groups[0])?.stage

  return (
    <div className="crm-card-sm lead-activity-panel" style={{ marginBottom: 14 }}>
      <div className="lead-section-title">Activity History</div>
      {!groups.length && <div className="lead-history-empty">No activity yet.</div>}
      {groups.map(({ stage, items }) => {
        const open = expanded[stage] ?? stage === defaultStage
        const visible = showAll[stage] ? items : items.slice(0, 3)
        return (
          <section className="lead-history-group" key={stage}>
            <button type="button" className="lead-history-group-toggle" aria-expanded={open}
              onClick={() => setExpanded(previous => ({ ...previous, [stage]: !open }))}>
              <span>{stage} <span className="lead-history-count">· {items.length} {items.length === 1 ? 'activity' : 'activities'}</span></span>
              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
            {open && <div className="lead-history-entries">
              {visible.map(item => {
                const ok = item.action === 'Approved' || item.action === 'Completed'
                const rejected = item.action === 'Rejected'
                const date = item.timestamp ? new Date(item.timestamp) : null
                const validDate = date && Number.isFinite(date.getTime())
                return (
                  <div key={item._id || item.originalIndex} className="history-item lead-history-row">
                    <div aria-hidden="true" className={`lead-history-icon ${ok ? 'ok' : rejected ? 'no' : ''}`}>
                      {ok ? '✓' : rejected ? '×' : '•'}
                    </div>
                    <div className="lead-history-content">
                      <div className="lead-history-entry-header">
                        <div className="lead-history-action">{item.action}</div>
                        <time className="lead-history-time" dateTime={validDate ? date.toISOString() : undefined}>
                          {validDate ? dateTime.format(date) : 'Date unavailable'}
                        </time>
                      </div>
                      {item.performedByName && <div className="lead-history-author">By: {item.performedByName}</div>}
                      {item.note && <div className="lead-history-note">{item.note}</div>}
                    </div>
                  </div>
                )
              })}
              {items.length > 3 && <button type="button" className="btn btn-ghost btn-sm lead-history-show-all"
                onClick={() => setShowAll(previous => ({ ...previous, [stage]: !previous[stage] }))}>
                {showAll[stage] ? 'Show less' : `Show all (${items.length})`}
              </button>}
            </div>}
          </section>
        )
      })}
    </div>
  )
}
