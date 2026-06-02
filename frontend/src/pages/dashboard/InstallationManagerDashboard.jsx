import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FaBell, FaEye, FaSolarPanel } from 'react-icons/fa'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import DispatchBillView from '../../components/dashboard/DispatchBillView'
import EnquiryFormModal from '../../components/dashboard/EnquiryFormModal'
import { dispatchAPI } from '../../services/api'

const statuses = ['Pending', 'In Progress', 'Completed']

export default function InstallationManagerDashboard() {
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingDispatch, setViewingDispatch] = useState(null)
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)

  const loadDispatches = () => {
    setLoading(true)
    dispatchAPI.getAll({ approvalStatus: 'Approved' })
      .then((res) => setDispatches(res.data.data || []))
      .catch((err) => toast.error(err.response?.data?.message || 'Installation queue load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(loadDispatches, [])

  const updateStatus = async (dispatch, status) => {
    try {
      await dispatchAPI.updateInstallationStatus(dispatch._id, status)
      toast.success('Installation status updated')
      setViewingDispatch(current => current?._id === dispatch._id ? { ...current, installationStatus: status } : current)
      loadDispatches()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed')
    }
  }

  if (loading) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaSolarPanel />}
        title="Installation Manager Dashboard"
        subtitle="Approved dispatches, locked bills and installation progress."
        action={<button type="button" className="btn btn-secondary" onClick={() => setShowEnquiryForm(true)}><FaBell /> Enquiry Form</button>}
      />

      <div className="dashboard-grid-metrics">
        {statuses.map(status => (
          <MetricCard key={status} icon={<FaSolarPanel />} label={status} value={dispatches.filter(item => item.installationStatus === status).length} change="Installation" changeColor={status === 'Completed' ? 'var(--green)' : status === 'In Progress' ? 'var(--sun)' : 'var(--blue)'} />
        ))}
      </div>

      {!dispatches.length ? <EmptyState title="No approved dispatches yet" /> : (
        <div className="dashboard-stack">
          {dispatches.map(dispatch => (
            <div key={dispatch._id} className="crm-card">
              <div className="dashboard-split-row" style={{ marginBottom:12 }}>
                <div>
                  <h3 style={{ fontSize:16, fontWeight:800 }}>{dispatch.billNo}</h3>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{dispatch.customerName} | {dispatch.mobile} | {dispatch.siteAddress}</div>
                </div>
                <div className="dashboard-inline-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewingDispatch(dispatch)}><FaEye /> View</button>
                  <select className="crm-input" style={{ maxWidth:180 }} value={dispatch.installationStatus} onChange={e => updateStatus(dispatch, e.target.value)}>
                    {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead><tr><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {dispatch.items.map((item, index) => (
                      <tr key={`${dispatch._id}-${item.productId || index}`}>
                        <td>{item.productName}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>₹{Number(item.price || 0).toLocaleString('en-IN')}</td>
                        <td>₹{Number(item.lineTotal || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dashboard-split-row" style={{ marginTop:12 }}>
                <span className="badge badge-green">Bill Locked</span>
                <strong>Grand Total: ₹{Number(dispatch.grandTotal || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingDispatch && (
        <DispatchBillView dispatch={viewingDispatch} onClose={() => setViewingDispatch(null)}>
          <select className="crm-input" style={{ maxWidth:220 }} value={viewingDispatch.installationStatus} onChange={e => updateStatus(viewingDispatch, e.target.value)}>
            {statuses.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </DispatchBillView>
      )}
      {showEnquiryForm && <EnquiryFormModal onClose={() => setShowEnquiryForm(false)} />}
    </div>
  )
}
