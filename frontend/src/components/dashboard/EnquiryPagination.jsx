export default function EnquiryPagination({ pagination, disabled, onChange }) {
  const { page,pages,total,limit } = pagination
  if (!total) return null
  const numbers = [...new Set([1,page - 1,page,page + 1,pages].filter(value => value > 0 && value <= pages))].sort((a,b) => a-b)
  return <nav className="lead-pagination enquiry-pagination" aria-label="Enquiry pages">
    <span className="compact-secondary" role="status">Showing {(page - 1) * limit + 1}-{Math.min(page * limit,total)} of {total} enquiries</span>
    <div className="lead-pagination-pages">
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      {numbers.map((value,index) => <span key={value} className="enquiry-page-number">
        {index > 0 && value - numbers[index - 1] > 1 && <span className="lead-pagination-ellipsis" aria-hidden="true">...</span>}
        <button type="button" className={`btn btn-sm ${value === page ? 'btn-primary' : 'btn-ghost'}`} aria-label={`Page ${value}`} aria-current={value === page ? 'page' : undefined} disabled={disabled || value === page} onClick={() => onChange(value)}>{value}</button>
      </span>)}
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
    <span className="compact-secondary">Page {page} of {pages}</span>
  </nav>
}
