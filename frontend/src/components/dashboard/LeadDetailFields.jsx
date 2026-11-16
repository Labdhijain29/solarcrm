export default function LeadDetailFields({ fields, style }) {
  return (
    <div className="lead-detail-layout" style={style}>
      <div className="lead-detail-grid">
        {fields.map(([label, value]) => {
          const wide = value && value !== '-' && (
            /note|remark|other|dispatched items/i.test(label) ||
            (typeof value === 'string' && (value.length > 120 || (/address/i.test(label) && (value.length > 80 || value.includes('\n')))))
          )
          return (
            <div key={label} className={`crm-card-sm lead-detail-field${wide ? ' lead-detail-field-wide' : ''}`}>
              <div className="lead-detail-label">{label}</div>
              <div className="lead-detail-value">{value}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
