import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FaEdit, FaPlus, FaSearch, FaTrash, FaWarehouse } from 'react-icons/fa'
import { EmptyState, MetricCard, PageHeader, SearchableSelect, Spinner } from '../../components/common'
import { productAPI } from '../../services/api'
import {
  DCR_GROUP,
  MODULE_GROUP_OPTIONS,
  STOCK_CATEGORY_OPTIONS,
  buildStructuredProductName,
  emptyStructuredProduct,
  getCapacityLabel,
  getCategoryLabel,
  getFieldLabel,
  getFixedSizeLabel,
  getProductBrandOptions,
  getProductCapacityOptions,
  getProductGroup,
  getProductModuleKind,
  isStructuredCategory,
  isSizedLengthGroup,
  setStructuredProductField,
} from './inventoryStructure'

const toOptions = (items, labelFormatter = (item) => item) => items.map((item) => ({ value: item, label: labelFormatter(item) }))

export default function StockManagerDashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyStructuredProduct)

  const loadStock = () => {
    setLoading(true)
    productAPI.getAll(search ? { search } : undefined)
      .then((res) => setProducts(res.data.data || []))
      .catch((err) => toast.error(err.response?.data?.message || 'Stock load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(loadStock, 250)
    return () => clearTimeout(timer)
  }, [search])

  const summary = useMemo(() => ({
    items: products.length,
    quantity: products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    value: products.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0),
    low: products.filter(item => Number(item.quantity || 0) <= Number(item.lowStockThreshold || 0)).length,
  }), [products])

  const currentGroup = getProductGroup(form)
  const brandOptions = getProductBrandOptions(form)
  const capacityOptions = getProductCapacityOptions(form)
  const structuredCategory = isStructuredCategory(form.category)

  const setField = (key, value) => {
    setForm(prev => setStructuredProductField(prev, key, value))
  }

  const resetForm = () => {
    setEditing(null)
    setForm(emptyStructuredProduct)
  }

  const submitStock = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        name: buildStructuredProductName(form),
        quantity: Number(form.quantity || 0),
        price: Number(form.price || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 0),
      }
      if (editing) await productAPI.update(editing._id, payload)
      else await productAPI.create(payload)
      toast.success(editing ? 'Stock updated' : 'Stock item added')
      resetForm()
      loadStock()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock save failed')
    } finally {
      setSaving(false)
    }
  }

  const editProduct = (product) => {
    setEditing(product)
    setForm({
      ...emptyStructuredProduct,
      name: product.name || '',
      category: product.category || emptyStructuredProduct.category,
      subCategory: product.subCategory || '',
      brand: product.brand || '',
      type: product.type || emptyStructuredProduct.type,
      capacity: product.capacity || emptyStructuredProduct.capacity,
      quantity: product.quantity ?? '',
      price: product.price ?? '',
      unit: product.unit || 'pcs',
      lowStockThreshold: product.lowStockThreshold ?? 10,
    })
  }

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return
    try {
      await productAPI.delete(product._id)
      toast.success('Stock item deleted')
      loadStock()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  if (loading && !products.length) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaWarehouse />}
        title="Stock Manager Dashboard"
        subtitle="Structured solar inventory with modules, categories, types, capacity, price and live stock."
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaWarehouse />} label="Items" value={summary.items} change="SKUs" changeColor="var(--blue)" />
        <MetricCard icon={<FaPlus />} label="Quantity" value={summary.quantity} change="Available" changeColor="var(--green)" />
        <MetricCard icon={<FaWarehouse />} label="Stock Value" value={`Rs. ${summary.value.toLocaleString('en-IN')}`} change="Qty x price" changeColor="var(--sun)" />
        <MetricCard icon={<FaTrash />} label="Low Stock" value={summary.low} change="At threshold" changeColor="var(--red)" />
      </div>

      <div className="dashboard-grid-two" style={{ alignItems: 'start' }}>
        <form className="crm-card" onSubmit={submitStock}>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>{editing ? 'Update Structured Stock Item' : 'Add Structured Stock Item'}</h3>
          <div className="dashboard-form-grid">
            <div>
              <label className="form-label">Type</label>
              <SearchableSelect
                name="stock-category"
                value={form.category}
                onChange={(value) => setField('category', value)}
                options={toOptions(STOCK_CATEGORY_OPTIONS, getCategoryLabel)}
                searchPlaceholder="Search type..."
              />
            </div>
            {structuredCategory ? (
              <>
                <div>
                  <label className="form-label">Module Category</label>
                  <SearchableSelect
                    name="module-group"
                    value={currentGroup}
                    onChange={(value) => setField('moduleGroup', value)}
                    options={MODULE_GROUP_OPTIONS}
                    searchPlaceholder="Search module category..."
                  />
                </div>

                {currentGroup === DCR_GROUP && (
                  <div>
                    <label className="form-label">Module Type</label>
                    <select className="crm-input" value={getProductModuleKind(form.type)} onChange={e => setField('moduleKind', e.target.value)}>
                      <option value="P-Type">P-Type</option>
                      <option value="N-Type">N-Type</option>
                    </select>
                  </div>
                )}

                {currentGroup === DCR_GROUP && getProductModuleKind(form.type) === 'N-Type' && (
                  <div>
                    <label className="form-label">Technology</label>
                    <select className="crm-input" value="TOPCon" onChange={() => {}}>
                      <option value="TOPCon">TOPCon</option>
                    </select>
                  </div>
                )}

                {isSizedLengthGroup(currentGroup) && (
                  <div>
                    <label className="form-label">Size</label>
                    <select className="crm-input" value={getFixedSizeLabel(currentGroup)} onChange={() => {}}>
                      <option value={getFixedSizeLabel(currentGroup)}>{getFixedSizeLabel(currentGroup)}</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="form-label">{getFieldLabel(currentGroup)}</label>
                  <SearchableSelect
                    name="capacity"
                    value={form.capacity}
                    onChange={(value) => setField('capacity', value)}
                    options={toOptions(capacityOptions, (item) => getCapacityLabel(currentGroup, item))}
                    searchPlaceholder={`Search ${getFieldLabel(currentGroup).toLowerCase()}...`}
                  />
                </div>

                {brandOptions.length > 0 && (
                  <div>
                    <label className="form-label">Brand</label>
                    <SearchableSelect
                      name="brand"
                      value={form.brand}
                      onChange={(value) => setField('brand', value)}
                      options={toOptions(brandOptions)}
                      searchPlaceholder="Search brand..."
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Brand</label>
                  <input className="crm-input" value={form.brand} onChange={e => setField('brand', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Type / Subcategory</label>
                  <input className="crm-input" value={form.type} onChange={e => setField('type', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Capacity / Variant</label>
                  <input className="crm-input" value={form.capacity} onChange={e => setField('capacity', e.target.value)} />
                </div>
              </>
            )}

            <div style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Item Name</label>
              <input className="crm-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Auto name bhi chalega, ya custom item name likhein" />
            </div>
            <div><label className="form-label">Quantity</label><input className="crm-input" type="number" min="0" value={form.quantity} onChange={e => setField('quantity', e.target.value)} required /></div>
            <div><label className="form-label">Price</label><input className="crm-input" type="number" min="0" value={form.price} onChange={e => setField('price', e.target.value)} required /></div>
            <div><label className="form-label">Unit</label><input className="crm-input" value={form.unit} onChange={e => setField('unit', e.target.value)} /></div>
            <div><label className="form-label">Low Stock Below</label><input className="crm-input" type="number" min="0" value={form.lowStockThreshold} onChange={e => setField('lowStockThreshold', e.target.value)} /></div>
          </div>
          <div className="dashboard-inline-actions" style={{ marginTop:16, justifyContent:'flex-end' }}>
            {editing && <button className="btn btn-ghost" type="button" onClick={resetForm}>Cancel</button>}
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Update' : 'Add Stock'}</button>
          </div>
        </form>

        <div className="crm-card">
          <div className="dashboard-search" style={{ marginBottom:16 }}><FaSearch /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stock..." /></div>
          {!products.length ? <EmptyState title="No stock items found" /> : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr><th>Name</th><th>Category</th><th>Type</th><th>Capacity</th><th>Qty</th><th>Price</th><th>Action</th></tr></thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product._id}>
                      <td><strong>{product.name}</strong><div style={{ fontSize:11, color:'var(--muted)' }}>{product.brand || '-'}</div></td>
                      <td>{product.category}</td>
                      <td>{product.type || '-'}</td>
                      <td>{product.capacity || '-'}</td>
                      <td>{product.quantity} {product.unit}</td>
                      <td>Rs. {Number(product.price || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <div className="dashboard-inline-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => editProduct(product)}><FaEdit /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => deleteProduct(product)}><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
