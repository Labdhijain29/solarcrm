import { FaClipboardList, FaRupeeSign, FaTimes, FaTruck, FaUserCog } from 'react-icons/fa'

const money = (value) => Number(value || 0).toLocaleString('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN')
}

const badgeClass = (status) => {
  if (status === 'Approved' || status === 'Completed' || status === 'Delivered') return 'badge-green'
  if (status === 'Pending' || status === 'In Progress' || status === 'Packed' || status === 'Out for Dispatch') return 'badge-sun'
  return 'badge-gray'
}

export default function DispatchBillView({ dispatch, onClose, children }) {
  if (!dispatch) return null

  const totalQty = (dispatch.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const payable = dispatch.payableAmount || dispatch.grandTotal

  return (
    <div className="modal-backdrop dispatch-bill-backdrop" onClick={onClose}>
      <div className="modal-box dispatch-bill-modal" onClick={(event) => event.stopPropagation()}>
        <div className="dispatch-bill-hero">
          <div>
            <h2>{dispatch.billNo || 'Dispatch Bill'}</h2>
            <p>{dispatch.customerName || '-'} | {dispatch.mobile || '-'} | {dispatch.siteAddress || '-'}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close bill view">
            <FaTimes />
          </button>
        </div>

        <div className="dispatch-bill-stats">
          <div>
            <span><FaClipboardList /></span>
            <strong>{dispatch.approvalStatus || 'Pending'}</strong>
            <small>Approval</small>
            <em>Bill status</em>
          </div>
          <div>
            <span><FaUserCog /></span>
            <strong>{dispatch.installationStatus || 'Pending'}</strong>
            <small>Installation</small>
            <em>Current status</em>
          </div>
          <div>
            <span><FaTruck /></span>
            <strong>{totalQty}</strong>
            <small>Material Qty</small>
            <em>Total items</em>
          </div>
          <div>
            <span><FaRupeeSign /></span>
            <strong>{money(payable)}</strong>
            <small>Grand Total</small>
            <em>Bill amount</em>
          </div>
        </div>

        <div className="dispatch-bill-info-grid">
          <label>
            <span>Lead ID / IVRS</span>
            <strong>{dispatch.leadId || '-'}</strong>
          </label>
          <label>
            <span>Engineer</span>
            <strong>{dispatch.installationAssigneeName || dispatch.engineerName || '-'}</strong>
          </label>
          <label>
            <span>Dispatch Date</span>
            <strong>{formatDate(dispatch.dispatchDate || dispatch.createdAt)}</strong>
          </label>
          <label>
            <span>Dispatch Status</span>
            <strong><span className={`badge ${badgeClass(dispatch.dispatchStatus)}`}>{dispatch.dispatchStatus || '-'}</span></strong>
          </label>
          <label>
            <span>Installation Status</span>
            <strong><span className={`badge ${badgeClass(dispatch.installationStatus)}`}>{dispatch.installationStatus || 'Pending'}</span></strong>
          </label>
          <label>
            <span>Payment Mode</span>
            <strong>{dispatch.paymentMode || '-'}</strong>
          </label>
        </div>

        {children && <div className="dispatch-bill-inline-actions">{children}</div>}

        <div className="crm-table-wrap dispatch-bill-table-wrap">
          <table className="crm-table dispatch-bill-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Capacity</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(dispatch.items || []).map((item, index) => (
                <tr key={`${dispatch._id}-${item.productId || index}`}>
                  <td><strong>{item.productName || '-'}</strong><br /><small>{item.productCode || item.sku || '-'}</small></td>
                  <td>{item.category || item.type || '-'}</td>
                  <td>{item.brand || '-'}</td>
                  <td>{item.capacity || '-'}</td>
                  <td>{Number(item.quantity || 0)} {item.unit || 'pcs'}</td>
                  <td>{money(item.price)}</td>
                  <td><strong>{money(item.lineTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dispatch-bill-total-strip">
          <span>Subtotal <strong>{money(dispatch.subTotal)}</strong></span>
          <span>GST <strong>{money(dispatch.gstTotal)}</strong></span>
          <span>Round Off <strong>{money(dispatch.roundOff)}</strong></span>
          <span>Final Payable <strong>{money(payable)}</strong></span>
        </div>
      </div>
    </div>
  )
}
