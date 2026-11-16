import { EmptyState } from '../common'
import LeadStatusToggle, { HOLD_STATUS_OPTIONS } from './LeadStatusToggle'

export default function DispatchLeadQueue({ leads, status, onStatusChange, onUpdated, onView, onBill }) {
  const actions = lead => <div className="dashboard-inline-actions">
    <button className="btn btn-ghost btn-sm" onClick={() => onView(lead)}>View / Approve</button>
    <button className="btn btn-secondary btn-sm" disabled={lead.status !== 'active'} onClick={() => onBill(lead)}>Create Bill</button>
  </div>
  return <div className="crm-card dispatch-lead-queue compact-list-region" style={{ marginBottom: 16 }}>
    <div className="dashboard-split-row" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700 }}>Leads at Dispatch ({leads.length})</h3>
      <div className="dashboard-inline-actions">
        <select className="crm-input" aria-label="Lead status filter" value={status} onChange={event => onStatusChange(event.target.value)}>
          {HOLD_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => onBill()}>New Bill</button>
      </div>
    </div>
    {!leads.length ? <EmptyState title="No leads match this status" /> : <div className="crm-table-wrap compact-table-wrap">
      <table className="crm-table compact-dashboard-table">
        <thead><tr><th>Customer</th><th>Phone / IVRS</th><th>City</th><th>Capacity</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{leads.map(lead => <tr key={lead._id}>
          <td><strong>{lead.name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{lead._id.slice(-6)}</div></td>
          <td>{lead.phone}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.ivrsNo || '-'}</div></td>
          <td>{lead.city || '-'}</td><td>{lead.capacity || '-'}</td>
          <td><LeadStatusToggle lead={lead} onUpdated={onUpdated} /></td><td>{actions(lead)}</td>
        </tr>)}</tbody>
      </table>
      <div className="crm-mobile-cards">{leads.map(lead => <div className="crm-mobile-card" key={lead._id}>
        <div className="dashboard-split-row" style={{ marginBottom: 10 }}>
          <strong>{lead.name}</strong><LeadStatusToggle lead={lead} onUpdated={onUpdated} />
        </div>
        <div className="crm-mobile-row"><span className="crm-mobile-label">Phone / IVRS</span><span>{lead.phone || '-'} / {lead.ivrsNo || '-'}</span></div>
        <div className="crm-mobile-row"><span className="crm-mobile-label">City / Capacity</span><span>{lead.city || '-'} / {lead.capacity || '-'}</span></div>
        {actions(lead)}
      </div>)}</div>
    </div>}
  </div>
}
