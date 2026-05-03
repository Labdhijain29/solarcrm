import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FaMinus, FaPlus, FaSearch, FaShippingFast, FaTrash } from 'react-icons/fa'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import { dispatchAPI, productAPI } from '../../services/api'
import {
  DCR_GROUP,
  MODULE_CATEGORY,
  MODULE_GROUP_OPTIONS,
  getBrandOptionsByGroup,
  getCapacityLabel,
  getCapacityOptionsByGroup,
  getFieldLabel,
  getFixedSizeLabel,
  isSizedLengthGroup,
  makeDispatchItem,
  matchesDispatchModule,
  setDispatchStructureField,
} from './inventoryStructure'

const emptyCustomer = {
  customerName: '',
  mobile: '',
  engineerName: '',
  siteAddress: '',
  leadId: '',
}

const makeBillNo = () => `BILL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-5)}`

export default function DispatchManagerDashboard() {
  const [products, setProducts] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState(emptyCustomer)
  const [stockFilter, setStockFilter] = useState(makeDispatchItem())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([productAPI.getAll(search ? { search } : undefined), dispatchAPI.getAll()])
      .then(([productRes, dispatchRes]) => {
        setProducts(productRes.data.data || [])
        setDispatches(dispatchRes.data.data || [])
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Dispatch data load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(loadData, 250)
    return () => clearTimeout(timer)
  }, [search])

  const brandOptions = getBrandOptionsByGroup(stockFilter.moduleGroup)
  const capacityOptions = getCapacityOptionsByGroup(stockFilter.moduleGroup, stockFilter.moduleType)

  const setFilterField = (key, value) => {
    setStockFilter(prev => setDispatchStructureField(prev, key, value))
  }

  const availableProducts = useMemo(() => products
    .filter(product => matchesDispatchModule(product, stockFilter))
    .map(product => {
      const cartItem = cart.find(item => item.productId === product._id)
      return { ...product, availableQuantity: Number(product.quantity || 0) - Number(cartItem?.quantity || 0) }
    }), [cart, products, stockFilter])

  const bill = useMemo(() => {
    const items = cart.map(item => ({
      ...item,
      lineTotal: Number(item.quantity || 0) * Number(item.price || 0),
    }))
    return {
      items,
      grandTotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    }
  }, [cart])

  const addToCart = (product) => {
    if (Number(product.availableQuantity || product.quantity || 0) <= 0) {
      toast.error('No stock available for this item')
      return
    }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product._id)
      if (existing) return prev.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...prev, {
        productId: product._id,
        name: product.name,
        category: product.category,
        brand: product.brand,
        type: product.type,
        capacity: product.capacity,
        quantity: 1,
        price: Number(product.price || 0),
        unit: product.unit || 'pcs',
      }]
    })
  }

  const changeQuantity = (productId, delta) => {
    const product = products.find(item => item._id === productId)
    setCart(prev => prev.flatMap(item => {
      if (item.productId !== productId) return [item]
      const nextQuantity = item.quantity + delta
      if (nextQuantity <= 0) return []
      if (product && nextQuantity > Number(product.quantity || 0)) {
        toast.error('No negative stock allowed')
        return [item]
      }
      return [{ ...item, quantity: nextQuantity }]
    }))
  }

  const approveDispatch = async () => {
    if (!bill.items.length) {
      toast.error('Dispatch list me kam se kam ek item add karein')
      return
    }
    if (!customer.customerName || !customer.mobile || !customer.engineerName || !customer.siteAddress) {
      toast.error('Customer, mobile, engineer and site address required')
      return
    }

    setSaving(true)
    try {
      const createRes = await dispatchAPI.create({
        ...customer,
        billNo: makeBillNo(),
        items: bill.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
      })
      await dispatchAPI.approve(createRes.data.data._id)
      toast.success('Dispatch approved, bill locked and sent to Installation Manager')
      setCart([])
      setCustomer(emptyCustomer)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch approval failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !products.length) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader icon={<FaShippingFast />} title="Dispatch Manager Dashboard" subtitle="Structured material selection, smart bill, approval and installation handoff." />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaShippingFast />} label="Cart Items" value={bill.items.length} change={`${bill.totalQuantity} qty`} changeColor="var(--blue)" />
        <MetricCard icon={<FaShippingFast />} label="Bill Total" value={`Rs. ${bill.grandTotal.toLocaleString('en-IN')}`} change="Auto synced" changeColor="var(--green)" />
        <MetricCard icon={<FaShippingFast />} label="Approved" value={dispatches.filter(item => item.approvalStatus === 'Approved').length} change="Sent to installation" changeColor="var(--sun)" />
        <MetricCard icon={<FaShippingFast />} label="Pending" value={dispatches.filter(item => item.approvalStatus === 'Pending').length} change="Awaiting approval" changeColor="var(--red)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(280px, 390px) 1fr', gap:16, alignItems:'start' }}>
        <aside className="crm-card">
          <div className="dashboard-search" style={{ marginBottom:14 }}><FaSearch /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search available stock..." /></div>

          <div className="dashboard-form-grid" style={{ gridTemplateColumns:'1fr', gap:10, marginBottom:16 }}>
            <div>
              <label className="form-label">Type</label>
              <select className="crm-input" value={MODULE_CATEGORY} onChange={() => {}}>
                <option value={MODULE_CATEGORY}>Module</option>
              </select>
            </div>
            <div>
              <label className="form-label">Module Category</label>
              <select className="crm-input" value={stockFilter.moduleGroup} onChange={e => setFilterField('moduleGroup', e.target.value)}>
                {MODULE_GROUP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {stockFilter.moduleGroup === DCR_GROUP && (
              <div>
                <label className="form-label">Module Type</label>
                <select className="crm-input" value={stockFilter.moduleType} onChange={e => setFilterField('moduleType', e.target.value)}>
                  <option value="P-Type">P-Type</option>
                  <option value="N-Type">N-Type</option>
                </select>
              </div>
            )}
            {stockFilter.moduleGroup === DCR_GROUP && stockFilter.moduleType === 'N-Type' && (
              <div>
                <label className="form-label">Technology</label>
                <select className="crm-input" value="TOPCon" onChange={() => {}}>
                  <option value="TOPCon">TOPCon</option>
                </select>
              </div>
            )}
            {isSizedLengthGroup(stockFilter.moduleGroup) && (
              <div>
                <label className="form-label">Size</label>
                <select className="crm-input" value={getFixedSizeLabel(stockFilter.moduleGroup)} onChange={() => {}}>
                  <option value={getFixedSizeLabel(stockFilter.moduleGroup)}>{getFixedSizeLabel(stockFilter.moduleGroup)}</option>
                </select>
              </div>
            )}
            <div>
              <label className="form-label">{getFieldLabel(stockFilter.moduleGroup)}</label>
              <select className="crm-input" value={stockFilter.capacity} onChange={e => setFilterField('capacity', e.target.value)}>
                {capacityOptions.map(capacity => <option key={capacity} value={capacity}>{getCapacityLabel(stockFilter.moduleGroup, capacity)}</option>)}
              </select>
            </div>
            {brandOptions.length > 0 && (
              <div>
                <label className="form-label">Brand</label>
                <select className="crm-input" value={stockFilter.brand} onChange={e => setFilterField('brand', e.target.value)}>
                  {brandOptions.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="dashboard-stack">
            {availableProducts.length === 0 ? (
              <EmptyState title="No matching stock found" subtitle="Module category, capacity or brand badal ke dekhein." />
            ) : availableProducts.map(product => (
              <div key={product._id} className="crm-card-sm">
                <div className="dashboard-split-row">
                  <strong>{product.name}</strong>
                  <span className={`badge ${product.availableQuantity > 0 ? 'badge-green' : 'badge-red'}`}>{product.availableQuantity} {product.unit}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>
                  {[product.category, product.brand, product.type, product.capacity].filter(Boolean).join(' | ')}
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Rs. {Number(product.price || 0).toLocaleString('en-IN')}</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop:10, width:'100%', justifyContent:'center' }} onClick={() => addToCart(product)} disabled={product.availableQuantity <= 0}><FaPlus /> Add to Dispatch</button>
              </div>
            ))}
          </div>
        </aside>

        <main className="dashboard-stack">
          <div className="crm-card">
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Customer & Site Details</h3>
            <div className="dashboard-form-grid">
              <div><label className="form-label">Customer Name</label><input className="crm-input" value={customer.customerName} onChange={e => setCustomer(prev => ({ ...prev, customerName: e.target.value }))} /></div>
              <div><label className="form-label">Mobile</label><input className="crm-input" value={customer.mobile} maxLength={10} onChange={e => setCustomer(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></div>
              <div><label className="form-label">Installation Engineer</label><input className="crm-input" value={customer.engineerName} onChange={e => setCustomer(prev => ({ ...prev, engineerName: e.target.value }))} /></div>
              <div><label className="form-label">Lead ID / IVRS</label><input className="crm-input" value={customer.leadId} onChange={e => setCustomer(prev => ({ ...prev, leadId: e.target.value }))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">Site Address</label><textarea className="crm-input" rows={2} value={customer.siteAddress} onChange={e => setCustomer(prev => ({ ...prev, siteAddress: e.target.value }))} /></div>
            </div>
          </div>

          <div className="crm-card">
            <div className="dashboard-split-row" style={{ marginBottom:16 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Dispatch List</h3>
              <button className="btn btn-primary btn-sm" onClick={approveDispatch} disabled={saving || !bill.items.length}>{saving ? 'Approving...' : 'Approve Dispatch'}</button>
            </div>
            {!bill.items.length ? <EmptyState title="Dispatch cart is empty" subtitle="Sidebar se structured material select karein." /> : (
              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Price</th><th>Total</th><th>Action</th></tr></thead>
                  <tbody>
                    {bill.items.map(item => (
                      <tr key={item.productId}>
                        <td><strong>{item.name}</strong><div style={{ fontSize:11, color:'var(--muted)' }}>{[item.brand, item.type, item.capacity].filter(Boolean).join(' | ')}</div></td>
                        <td>{item.category}</td>
                        <td>
                          <div className="dashboard-inline-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => changeQuantity(item.productId, -1)}><FaMinus /></button>
                            <strong>{item.quantity} {item.unit}</strong>
                            <button className="btn btn-ghost btn-sm" onClick={() => changeQuantity(item.productId, 1)}><FaPlus /></button>
                          </div>
                        </td>
                        <td>Rs. {item.price.toLocaleString('en-IN')}</td>
                        <td>Rs. {item.lineTotal.toLocaleString('en-IN')}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => setCart(prev => prev.filter(row => row.productId !== item.productId))}><FaTrash /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="crm-card">
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Smart Bill</h3>
            {bill.items.map(item => (
              <div key={item.productId} style={{ display:'grid', gridTemplateColumns:'1fr 80px 120px 130px', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span>{item.name}</span>
                <strong>{item.quantity}</strong>
                <span>Rs. {item.price.toLocaleString('en-IN')}</span>
                <strong>Rs. {item.lineTotal.toLocaleString('en-IN')}</strong>
              </div>
            ))}
            <div className="dashboard-split-row" style={{ marginTop:16, fontSize:16 }}>
              <strong>Grand Total</strong>
              <strong>Rs. {bill.grandTotal.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
