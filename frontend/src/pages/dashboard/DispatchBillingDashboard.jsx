import { configureStore, createSlice } from '@reduxjs/toolkit'
import jsPDF from 'jspdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FaBarcode, FaCheck, FaDownload, FaFileExcel, FaFileInvoice, FaFilePdf, FaPause, FaPrint, FaSearch, FaShippingFast, FaTrash } from 'react-icons/fa'
import { Provider, useDispatch, useSelector } from 'react-redux'
import Select from 'react-select'
import * as XLSX from 'xlsx'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import { dispatchAPI, productAPI, usersAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import {
  AC_DC_GROUP,
  BASE_PLATE_GROUP,
  C_CHANNEL_GROUP,
  CABLE_TRY_GROUP,
  DCR_GROUP,
  EARTHING_KIT_GROUP,
  FASTNER_GROUP,
  HEAD_PARLIN_GROUP,
  INVERTER_GROUP,
  MODULE_GROUP_OPTIONS,
  NON_MODULE_GROUPS,
  PIPE_GROUP,
  ALBA_GROUP,
  SS_NUT_BOLT_GROUP,
  STRUCTURE_GROUP,
  TE_GROUP,
  getBrandOptionsByGroup,
  getCapacityLabel,
  getCapacityOptionsByGroup,
  getFieldLabel,
  getProductGroup,
  matchesDispatchModule,
} from './inventoryStructure'

const PAYMENT_OPTIONS = ['Credit', 'Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map(value => ({ value, label: value }))
const DISPATCH_OPTIONS = ['Not Packed', 'Packed', 'Out for Dispatch', 'Delivered'].map(value => ({ value, label: value }))
const emptyLine = () => ({
  lineId: crypto.randomUUID(),
  productId: '',
  query: '',
  quantity: 1,
  unit: '',
  price: 0,
  discountPercent: 0,
  gstPercent: 18,
  availableStock: 0,
  productCode: '',
  moduleGroup: '',
  moduleType: '',
  capacity: '',
  brand: '',
  category: '',
})
const emptyCustomer = (user) => ({
  billNo: `DSP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-5)}`,
  customerName: '',
  customerGst: '',
  customerEmail: '',
  mobile: '',
  leadId: '',
  siteAddress: '',
  engineerName: '',
  salesPersonName: user?.name || '',
  dispatchDate: new Date().toISOString().slice(0, 10),
  paymentMode: 'Credit',
  dispatchStatus: 'Not Packed',
  narration: '',
})

const dispatchSlice = createSlice({
  name: 'dispatchBilling',
  initialState: { products: [], invoices: [], users: [], loading: true },
  reducers: {
    setBootData: (state, action) => ({ ...state, ...action.payload, loading: false }),
    upsertInvoice: (state, action) => {
      const invoice = action.payload
      const index = state.invoices.findIndex(item => item._id === invoice._id)
      if (index >= 0) state.invoices[index] = invoice
      else state.invoices.unshift(invoice)
    },
  },
})

const billingStore = configureStore({ reducer: { dispatchBilling: dispatchSlice.reducer } })
const { setBootData, upsertInvoice } = dispatchSlice.actions
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const productCode = (product) => product.productCode || product.sku || product._id?.slice(-6)?.toUpperCase() || ''
const getPrice = (product) => Number(product.salePrice || product.price || 0)
const productSearchText = (product) => [product.name, product.sku, product.productCode, product.brand, product.category, product.type, product.capacity].join(' ').toLowerCase()
const SIMPLE_SIZE_GROUPS = [STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP, BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP]
const groupLabel = (group) => MODULE_GROUP_OPTIONS.find(option => option.value === group)?.label || group || '-'
const productModuleType = (product) => product.capacity || product.type || product.name || '-'
const productMeta = (product) => ({
  moduleGroup: getProductGroup(product),
  moduleType: getProductGroup(product) === DCR_GROUP ? (String(product.type || '').includes('N-Type') ? 'N-Type' : 'P-Type') : (product.type || ''),
  capacity: product.capacity || '',
  brand: product.brand || '',
  category: product.capacity || '',
  moduleTypeLabel: productModuleType(product),
})
const uniqueOptions = (values) => Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
  .sort((a, b) => a.localeCompare(b))
const moduleTypeOptionsByGroup = (group) => {
  if (!group) return []
  if (group === DCR_GROUP) return ['P-Type', 'N-Type']
  if (group === INVERTER_GROUP) return ['Capacity']
  if (group === AC_DC_GROUP) return ['Phase']
  if (group === CABLE_TRY_GROUP) return ['Item']
  if (SIMPLE_SIZE_GROUPS.includes(group)) return ['Size']
  return ['Type']
}
const stockMatcherLine = (line, upto = 'brand') => ({
  moduleGroup: line.moduleGroup,
  moduleType: ['capacity', 'brand'].includes(upto) ? line.moduleType : '',
  capacity: upto === 'brand' ? line.capacity : '',
  brand: upto === 'brand' ? line.brand : '',
})
const productMatchesBillingLine = (product, line, upto = 'brand') => {
  if (!line.moduleGroup) return true
  if (getProductGroup(product) !== line.moduleGroup) return false
  if (upto === 'group') return true
  if (line.moduleType && line.moduleGroup === DCR_GROUP) {
    const expectedType = line.moduleType === 'N-Type' ? 'N-Type TOPCon' : 'DCR P-Type'
    if (String(product.type || '') !== expectedType) return false
  }
  if (upto === 'moduleType') return true
  if (line.capacity && String(product.capacity || '').replace(/\s+/g, '').toLowerCase() !== String(line.capacity || '').replace(/\s+/g, '').toLowerCase()) return false
  if (upto === 'capacity') return true
  if (getBrandOptionsByGroup(line.moduleGroup).length && line.brand && !matchesDispatchModule(product, stockMatcherLine(line))) return false
  return true
}

function calculateLines(lines) {
  const enriched = lines.map((line) => {
    const quantity = Number(line.quantity || 0)
    const price = Number(line.price || 0)
    const discountPercent = Number(line.discountPercent || 0)
    const gstPercent = Number(line.gstPercent || 0)
    const gross = quantity * price
    const discountAmount = gross * discountPercent / 100
    const taxableAmount = Math.max(gross - discountAmount, 0)
    const gstAmount = taxableAmount * gstPercent / 100
    return { ...line, amount: taxableAmount + gstAmount, taxableAmount, gstAmount, discountAmount }
  })
  const subTotal = enriched.reduce((sum, line) => sum + line.taxableAmount, 0)
  const discountTotal = enriched.reduce((sum, line) => sum + line.discountAmount, 0)
  const gstTotal = enriched.reduce((sum, line) => sum + line.gstAmount, 0)
  const grandTotal = enriched.reduce((sum, line) => sum + line.amount, 0)
  const finalPayable = Math.round(grandTotal)
  return { lines: enriched, subTotal, discountTotal, gstTotal, grandTotal, roundOff: finalPayable - grandTotal, finalPayable }
}

function ProductAutocomplete({ line, rowIndex, products, onSelect, onQuery, onKeyMove }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const matches = useMemo(() => {
    const query = String(line.query || '').trim().toLowerCase()
    const source = query ? products.filter(product => productSearchText(product).includes(query)) : products
    return source
  }, [products, line.query])

  const choose = (product) => {
    onSelect(rowIndex, product)
    setOpen(false)
    requestAnimationFrame(() => inputRef.current?.closest('tr')?.querySelector('[data-cell="qty"]')?.focus())
  }

  return (
    <div className="erp-autocomplete">
      <input
        ref={inputRef}
        className="crm-input erp-cell-input"
        value={line.query}
        placeholder="Type product / SKU / brand"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onQuery(rowIndex, event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive(prev => Math.min(prev + 1, matches.length - 1))
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive(prev => Math.max(prev - 1, 0))
            return
          }
          if (event.key === 'Enter' && matches[active]) {
            event.preventDefault()
            choose(matches[active])
            return
          }
          onKeyMove(event, rowIndex)
        }}
      />
      {open && (
        <div className="erp-autocomplete-menu">
          {matches.length === 0 ? (
            <div className="erp-autocomplete-empty">No stock item found</div>
          ) : (
            <>
              <div className="erp-autocomplete-count">{matches.length} stock items</div>
              {matches.map((product, index) => (
                <button
                  type="button"
                  key={product._id}
                  className={`erp-autocomplete-option ${index === active ? 'active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(product)}
                >
                  <span>
                    <strong>{product.name}</strong>
                    <small>{productCode(product)} | Brand: {product.brand || 'No brand'}</small>
                    <span className="erp-product-meta">
                      <em>Module Category: {groupLabel(getProductGroup(product))}</em>
                      <em>Module Type: {productModuleType(product)}</em>
                      <em>{getFieldLabel(getProductGroup(product))}: {product.capacity || '-'}</em>
                    </span>
                  </span>
                  <span>{Number(product.quantity || 0)} {product.unit || 'pcs'}<br /><small>{money(getPrice(product))}</small></span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CascadingProductSelector({
  line,
  rowIndex,
  products,
  moduleCategoryOptions,
  getModuleTypeOptions,
  getCategoryOptions,
  getBrandOptions,
  getFilteredProducts,
  onCascadeChange,
  onSelect,
  onQuery,
  onKeyMove,
}) {
  const typeRef = useRef(null)
  const categoryRef = useRef(null)
  const brandRef = useRef(null)
  const productRef = useRef(null)
  const filteredProducts = getFilteredProducts(line)

  const changeCascade = (field, value) => {
    onCascadeChange(rowIndex, field, value)
    requestAnimationFrame(() => {
      if (field === 'moduleGroup') typeRef.current?.focus()
      if (field === 'moduleType') categoryRef.current?.focus()
      if (field === 'capacity') {
        const nextLine = { ...line, capacity: value }
        const brandOptions = getBrandOptions(nextLine)
        if (brandOptions.length) brandRef.current?.focus()
        else productRef.current?.querySelector('input')?.focus()
      }
      if (field === 'brand') productRef.current?.querySelector('input')?.focus()
    })
  }

  return (
    <div className="erp-cascade-picker">
      <select className="crm-input erp-cell-input" value={line.moduleGroup} onChange={event => changeCascade('moduleGroup', event.target.value)}>
        <option value="">Module Category</option>
        {moduleCategoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select ref={typeRef} className="crm-input erp-cell-input" value={line.moduleType} onChange={event => changeCascade('moduleType', event.target.value)} disabled={!line.moduleGroup}>
        <option value="">Module Type</option>
        {getModuleTypeOptions(line).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <select ref={categoryRef} className="crm-input erp-cell-input" value={line.capacity} onChange={event => changeCascade('capacity', event.target.value)} disabled={!line.moduleType}>
        <option value="">{getFieldLabel(line.moduleGroup)}</option>
        {getCategoryOptions(line).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select ref={brandRef} className="crm-input erp-cell-input" value={line.brand} onChange={event => changeCascade('brand', event.target.value)} disabled={!line.capacity}>
        <option value="">{getBrandOptions(line).length ? 'Brand' : 'No Brand'}</option>
        {getBrandOptions(line).map(option => <option key={option} value={option}>{option || 'No Brand'}</option>)}
      </select>
      <div ref={productRef} className="erp-cascade-product">
        <ProductAutocomplete line={line} rowIndex={rowIndex} products={filteredProducts} onSelect={onSelect} onQuery={onQuery} onKeyMove={onKeyMove} />
        <small className="erp-muted">{filteredProducts.length} filtered stock items</small>
      </div>
    </div>
  )
}

function DispatchBillingInner() {
  const { user } = useAuthStore()
  const dispatch = useDispatch()
  const { products, invoices, users, loading } = useSelector(state => state.dispatchBilling)
  const [lines, setLines] = useState([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { register, control, reset, handleSubmit, getValues } = useForm({ defaultValues: emptyCustomer(user) })
  const calculated = useMemo(() => calculateLines(lines), [lines])
  const moduleCategoryOptions = useMemo(() => MODULE_GROUP_OPTIONS, [])

  const loadData = async () => {
    try {
      const [productRes, dispatchRes, userRes] = await Promise.all([
        productAPI.getAll({ limit: 1000 }),
        dispatchAPI.getAll({ limit: 1000 }),
        usersAPI.getAssignable({ roles: 'Installation Manager,Sales Manager,Sales Executive' }).catch(() => ({ data: { data: [] } })),
      ])
      dispatch(setBootData({
        products: productRes.data.data || [],
        invoices: dispatchRes.data.data || [],
        users: userRes.data.data || [],
      }))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load dispatch billing data')
      dispatch(setBootData({ products: [], invoices: [], users: [] }))
    }
  }

  useEffect(() => { loadData() }, [])

  const resetBill = () => {
    reset(emptyCustomer(user))
    setLines([emptyLine()])
  }

  const updateLine = (index, patch) => {
    setLines(prev => prev.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const selectProduct = (index, product) => {
    updateLine(index, selectProductPatch(product))
  }

  const resetProductSelection = {
    productId: '',
    query: '',
    unit: '',
    price: 0,
    discountPercent: 0,
    gstPercent: 18,
    availableStock: 0,
    productCode: '',
  }

  const selectProductPatch = (product) => ({
    productId: product._id,
    query: product.name,
    unit: product.unit || 'pcs',
    price: getPrice(product),
    gstPercent: Number(product.gstPercent ?? 18),
    availableStock: Number(product.quantity || 0),
    productCode: productCode(product),
    ...productMeta(product),
  })

  const handleCascadeChange = (index, field, value) => {
    const firstBrand = field === 'moduleGroup' ? (getBrandOptionsByGroup(value)[0] || '') : ''
    const resetByField = {
      moduleGroup: { moduleGroup: value, moduleType: '', capacity: '', category: '', brand: firstBrand, ...resetProductSelection },
      moduleType: { moduleType: value, capacity: '', category: '', brand: getBrandOptionsByGroup(lines[index]?.moduleGroup)[0] || '', ...resetProductSelection },
      capacity: { capacity: value, category: value, brand: getBrandOptionsByGroup(lines[index]?.moduleGroup)[0] || '', ...resetProductSelection },
      brand: { brand: value, ...resetProductSelection },
    }
    const nextPatch = resetByField[field] || { [field]: value }
    setLines(prev => prev.map((line, lineIndex) => {
      if (lineIndex !== index) return line
      const nextLine = { ...line, ...nextPatch }
      if (field === 'brand') {
        const exactMatches = products.filter(product => productMatchesBillingLine(product, nextLine))
        if (exactMatches.length === 1) {
          return { ...nextLine, ...selectProductPatch(exactMatches[0]) }
        }
      }
      return nextLine
    }))
  }

  const getModuleTypeOptions = (line) => moduleTypeOptionsByGroup(line.moduleGroup)
  const getCategoryOptions = (line) => uniqueOptions(getCapacityOptionsByGroup(line.moduleGroup, line.moduleType))
    .map(option => ({ value: option, label: getCapacityLabel(line.moduleGroup, option) || option }))
  const getBrandOptions = (line) => uniqueOptions(
    [
      ...getBrandOptionsByGroup(line.moduleGroup),
      ...products
        .filter(product => productMatchesBillingLine(product, line, 'capacity'))
        .map(product => product.brand || ''),
    ]
  )
  const getFilteredProducts = (line) => products.filter(product => productMatchesBillingLine(product, line, 'brand'))

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const deleteLine = (lineId) => setLines(prev => prev.length > 1 ? prev.filter(line => line.lineId !== lineId) : [emptyLine()])
  const keyMove = (event, index) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (index === lines.length - 1) addLine()
    requestAnimationFrame(() => document.querySelectorAll('.erp-billing-table tbody tr')[index + 1]?.querySelector('input')?.focus())
  }

  const payload = (form, approvalStatus) => ({
    ...form,
    approvalStatus,
    items: calculated.lines.filter(line => line.productId).map(line => ({
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      price: Number(line.price || 0),
      discountPercent: Number(line.discountPercent || 0),
      gstPercent: Number(line.gstPercent || 0),
    })),
  })

  const saveBill = async (form, approvalStatus = 'Pending') => {
    const validLines = calculated.lines.filter(line => line.productId && Number(line.quantity || 0) > 0)
    if (!validLines.length) return toast.error('Add at least one stock item.')
    if (validLines.some(line => approvalStatus === 'Pending' && Number(line.quantity || 0) > Number(line.availableStock || 0))) {
      return toast.error('One or more rows exceed available stock.')
    }

    setSaving(true)
    try {
      const res = await dispatchAPI.create(payload(form, approvalStatus))
      dispatch(upsertInvoice(res.data.data))
      toast.success(approvalStatus === 'Draft' ? 'Draft saved' : approvalStatus === 'Hold' ? 'Invoice held' : 'Bill saved and stock reduced')
      resetBill()
      await loadData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save bill')
    } finally {
      setSaving(false)
    }
  }

  const approveInvoice = async (invoice) => {
    try {
      const res = await dispatchAPI.approve(invoice._id)
      dispatch(upsertInvoice(res.data.data))
      toast.success('Approved and moved to Installation Manager')
      await loadData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval failed')
    }
  }

  const createPdf = (invoiceData = null) => {
    const form = invoiceData || { ...getValues(), items: calculated.lines, subTotal: calculated.subTotal, discountTotal: calculated.discountTotal, gstTotal: calculated.gstTotal, grandTotal: calculated.grandTotal, roundOff: calculated.roundOff, payableAmount: calculated.finalPayable }
    const doc = new jsPDF()
    doc.setFontSize(15)
    doc.text('Mahaveer Multi Engineering', 14, 16)
    doc.setFontSize(9)
    doc.text('GSTIN: 24ABCDE1234F1Z5 | Solar CRM Dispatch Invoice', 14, 22)
    doc.text(`Invoice: ${form.billNo || '-'} | Date: ${(form.dispatchDate || '').slice(0, 10)}`, 14, 38)
    doc.text(`Customer: ${form.customerName || '-'}`, 14, 45)
    doc.text(`Mobile: ${form.mobile || '-'} | GST: ${form.customerGst || '-'}`, 14, 52)
    doc.text(`Address: ${form.siteAddress || '-'}`.slice(0, 105), 14, 59)
    let y = 72
    doc.setFontSize(8)
    doc.text('Sr  Product                         Qty Unit Price Disc GST Amount', 14, y)
    y += 6
    ;(form.items || []).forEach((item, index) => {
      const amount = item.lineTotal || item.amount || (Number(item.quantity || 0) * Number(item.price || 0))
      doc.text(`${index + 1}`.padEnd(3) + `${item.productName || item.query || 'Item'}`.slice(0, 31).padEnd(32) + `${item.quantity || 0}`.padEnd(5) + `${item.unit || ''}`.padEnd(5) + `${Number(item.price || 0).toFixed(0)}`.padEnd(7) + `${item.discountPercent || 0}%`.padEnd(6) + `${item.gstPercent || 0}%`.padEnd(5) + `${Number(amount || 0).toFixed(2)}`, 14, y)
      y += 6
    })
    y += 4
    doc.text(`Subtotal: ${money(form.subTotal)}   GST: ${money(form.gstTotal)}   Discount: ${money(form.discountTotal)}`, 14, y)
    doc.setFontSize(12)
    doc.text(`Payable: ${money(form.payableAmount || form.finalPayable || form.grandTotal)}`, 14, y + 10)
    doc.save(`${form.billNo || 'dispatch-invoice'}.pdf`)
  }

  const printInvoice = () => window.print()
  const exportExcel = () => {
    const rows = invoices.map(invoice => ({
      BillNo: invoice.billNo,
      Date: new Date(invoice.dispatchDate || invoice.createdAt).toLocaleDateString('en-IN'),
      Customer: invoice.customerName,
      Mobile: invoice.mobile,
      Status: invoice.approvalStatus,
      DispatchStatus: invoice.dispatchStatus,
      Payable: invoice.payableAmount || invoice.grandTotal,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Dispatch Invoices')
    XLSX.writeFile(wb, 'dispatch-invoices.xlsx')
  }

  const filteredInvoices = invoices.filter(invoice => {
    const haystack = [invoice.billNo, invoice.customerName, invoice.mobile, invoice.leadId, invoice.engineerName].join(' ').toLowerCase()
    return (!search || haystack.includes(search.toLowerCase())) && (!statusFilter || invoice.approvalStatus === statusFilter)
  })
  const pendingInvoices = invoices.filter(invoice => invoice.approvalStatus === 'Pending')
  const lowStock = products.filter(product => Number(product.quantity || 0) <= Number(product.lowStockThreshold || 10)).slice(0, 6)
  const installerOptions = users.map(person => ({ value: person.name, label: `${person.name} | ${person.role}` }))

  if (loading) return <Spinner />

  return (
    <div className="dashboard-page dispatch-erp-page">
      <PageHeader
        icon={<FaFileInvoice />}
        title="Dispatch Manager Billing"
        subtitle="Busy/Tally-style stock invoice, approval, PDF, reports, and installation handoff."
        action={<div className="dashboard-inline-actions"><button className="btn btn-secondary" onClick={exportExcel}><FaFileExcel /> Export</button><button className="btn btn-ghost" onClick={printInvoice}><FaPrint /> Print</button></div>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaFileInvoice />} label="Total invoices" value={invoices.length} />
        <MetricCard icon={<FaShippingFast />} label="Pending dispatches" value={pendingInvoices.length} />
        <MetricCard icon={<FaCheck />} label="Approved bills" value={invoices.filter(item => item.approvalStatus === 'Approved').length} />
        <MetricCard icon={<FaBarcode />} label="Low stock alerts" value={lowStock.length} change="Barcode-ready billing input" />
      </div>

      <form className="crm-card erp-billing-card" onSubmit={handleSubmit(form => saveBill(form, 'Pending'))}>
        <div className="dashboard-split-row">
          <h3>Sales / Dispatch Invoice</h3>
          <div className="dashboard-inline-actions">
            <button type="button" className="btn btn-ghost" onClick={handleSubmit(form => saveBill(form, 'Draft'))}><FaDownload /> Draft</button>
            <button type="button" className="btn btn-secondary" onClick={handleSubmit(form => saveBill(form, 'Hold'))}><FaPause /> Hold</button>
            <button type="button" className="btn btn-secondary" onClick={() => createPdf()}><FaFilePdf /> PDF</button>
            <button className="btn btn-primary" disabled={saving}><FaCheck /> {saving ? 'Saving...' : 'Save Bill'}</button>
          </div>
        </div>

        <div className="dashboard-form-grid erp-head-grid">
          <div><label className="form-label">Bill No.</label><input className="crm-input" {...register('billNo', { required: true })} /></div>
          <div><label className="form-label">Date</label><input type="date" className="crm-input" {...register('dispatchDate')} /></div>
          <div><label className="form-label">Customer</label><input className="crm-input" {...register('customerName', { required: true })} placeholder="Customer search / name" /></div>
          <div><label className="form-label">Mobile</label><input className="crm-input" maxLength={10} {...register('mobile', { required: true })} /></div>
          <div><label className="form-label">GST No.</label><input className="crm-input" {...register('customerGst')} /></div>
          <div><label className="form-label">Lead / Deal No.</label><input className="crm-input" {...register('leadId')} /></div>
          <div><label className="form-label">Payment Mode</label><Controller name="paymentMode" control={control} render={({ field }) => <Select classNamePrefix="erp-select" options={PAYMENT_OPTIONS} value={PAYMENT_OPTIONS.find(item => item.value === field.value)} onChange={option => field.onChange(option.value)} />} /></div>
          <div><label className="form-label">Dispatch Status</label><Controller name="dispatchStatus" control={control} render={({ field }) => <Select classNamePrefix="erp-select" options={DISPATCH_OPTIONS} value={DISPATCH_OPTIONS.find(item => item.value === field.value)} onChange={option => field.onChange(option.value)} />} /></div>
          <div><label className="form-label">Installation Manager</label><Controller name="engineerName" control={control} rules={{ required: true }} render={({ field }) => <Select classNamePrefix="erp-select" options={installerOptions} value={installerOptions.find(item => item.value === field.value) || null} onChange={option => field.onChange(option?.value || '')} placeholder="Search engineer..." />} /></div>
          <div><label className="form-label">Sales Person</label><input className="crm-input" {...register('salesPersonName')} /></div>
          <div style={{ gridColumn:'1/-1' }}><label className="form-label">Site Address</label><textarea rows={2} className="crm-input" {...register('siteAddress', { required: true })} /></div>
        </div>

        <div className="erp-barcode-strip">
          <FaBarcode />
          <input className="crm-input" placeholder="Scan barcode / type product code and press Enter" onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            const product = products.find(item => [item.sku, item.productCode].filter(Boolean).some(code => String(code).toLowerCase() === event.currentTarget.value.toLowerCase()))
            if (!product) return toast.error('Barcode item not found')
            const emptyIndex = lines.findIndex(line => !line.productId)
            selectProduct(emptyIndex >= 0 ? emptyIndex : lines.length - 1, product)
            if (emptyIndex < 0) addLine()
            event.currentTarget.value = ''
          }} />
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table erp-billing-table">
            <thead><tr><th>Sr</th><th>Module Filter / Product Name</th><th>Qty</th><th>Unit</th><th>Price</th><th>Discount</th><th>GST</th><th>Amount</th><th>Available Stock</th><th></th></tr></thead>
            <tbody>
              {calculated.lines.map((line, index) => (
                <tr key={line.lineId}>
                  <td>{index + 1}</td>
                  <td>
                    <CascadingProductSelector
                      line={line}
                      rowIndex={index}
                      products={products}
                      moduleCategoryOptions={moduleCategoryOptions}
                      getModuleTypeOptions={getModuleTypeOptions}
                      getCategoryOptions={getCategoryOptions}
                      getBrandOptions={getBrandOptions}
                      getFilteredProducts={getFilteredProducts}
                      onCascadeChange={handleCascadeChange}
                      onSelect={selectProduct}
                      onQuery={(row, query) => updateLine(row, { query })}
                      onKeyMove={keyMove}
                    />
                    <small className="erp-muted">{line.productCode}</small>
                    {(line.moduleGroup || line.moduleType || line.brand || line.capacity) && (
                      <div className="erp-line-meta">
                        <span>Module Category: {groupLabel(line.moduleGroup)}</span>
                        <span>Module Type: {line.moduleType || '-'}</span>
                        <span>{getFieldLabel(line.moduleGroup)}: {line.capacity ? getCapacityLabel(line.moduleGroup, line.capacity) : '-'}</span>
                        <span>Brand: {line.brand || '-'}</span>
                      </div>
                    )}
                  </td>
                  <td><input data-cell="qty" className="crm-input erp-cell-input" type="number" min="1" value={line.quantity} onChange={event => updateLine(index, { quantity: event.target.value })} onKeyDown={event => keyMove(event, index)} /></td>
                  <td>{line.unit || '-'}</td>
                  <td><input className="crm-input erp-cell-input" type="number" value={line.price} onChange={event => updateLine(index, { price: event.target.value })} /></td>
                  <td><input className="crm-input erp-cell-input" type="number" value={line.discountPercent} onChange={event => updateLine(index, { discountPercent: event.target.value })} /></td>
                  <td><input className="crm-input erp-cell-input" type="number" value={line.gstPercent} onChange={event => updateLine(index, { gstPercent: event.target.value })} /></td>
                  <td><strong>{money(line.amount)}</strong></td>
                  <td><span className={Number(line.quantity || 0) > Number(line.availableStock || 0) ? 'badge badge-red' : 'badge badge-green'}>{line.availableStock} {line.unit}</span></td>
                  <td><button type="button" className="btn btn-ghost btn-icon" onClick={() => deleteLine(line.lineId)}><FaTrash /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="erp-footer-grid">
          <div><label className="form-label">Narration</label><textarea rows={4} className="crm-input" {...register('narration')} placeholder="Delivery notes, vehicle, payment remarks..." /></div>
          <div className="erp-total-box">
            <div><span>Subtotal</span><strong>{money(calculated.subTotal)}</strong></div>
            <div><span>Discount</span><strong>{money(calculated.discountTotal)}</strong></div>
            <div><span>GST</span><strong>{money(calculated.gstTotal)}</strong></div>
            <div><span>Grand Total</span><strong>{money(calculated.grandTotal)}</strong></div>
            <div><span>Round Off</span><strong>{money(calculated.roundOff)}</strong></div>
            <div className="erp-payable"><span>Final Payable</span><strong>{money(calculated.finalPayable)}</strong></div>
          </div>
        </div>
      </form>

      <div className="dashboard-grid-sidebar" style={{ marginTop:16 }}>
        <div className="crm-card">
          <div className="dashboard-table-filters">
            <div className="dashboard-search"><FaSearch /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search invoice, customer, mobile..." /></div>
            <select className="crm-input" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All status</option><option>Draft</option><option>Hold</option><option>Pending</option><option>Approved</option></select>
          </div>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Bill</th><th>Customer</th><th>Status</th><th>Dispatch</th><th>Payable</th><th>Action</th></tr></thead>
              <tbody>{filteredInvoices.slice(0, 12).map(invoice => (
                <tr key={invoice._id}>
                  <td><strong>{invoice.billNo}</strong><br /><small>{new Date(invoice.dispatchDate || invoice.createdAt).toLocaleDateString('en-IN')}</small></td>
                  <td>{invoice.customerName}<br /><small>{invoice.mobile}</small></td>
                  <td><span className={`badge ${invoice.approvalStatus === 'Approved' ? 'badge-green' : invoice.approvalStatus === 'Pending' ? 'badge-sun' : 'badge-gray'}`}>{invoice.approvalStatus}</span></td>
                  <td>{invoice.dispatchStatus || '-'}</td>
                  <td>{money(invoice.payableAmount || invoice.grandTotal)}</td>
                  <td className="dashboard-inline-actions"><button className="btn btn-ghost btn-sm" onClick={() => createPdf(invoice)}><FaFilePdf /></button>{invoice.approvalStatus === 'Pending' && <button className="btn btn-primary btn-sm" onClick={() => approveInvoice(invoice)}>Approve</button>}</td>
                </tr>
              ))}</tbody>
            </table>
            {filteredInvoices.length === 0 && <EmptyState title="No invoices found" subtitle="Create a bill or adjust filters." />}
          </div>
        </div>
        <div className="dashboard-stack">
          <div className="crm-card"><h3>Low Stock Alerts</h3>{lowStock.map(item => <div className="erp-alert-row" key={item._id}><span>{item.name}<small>{item.category}</small></span><strong>{item.quantity} {item.unit}</strong></div>)}{lowStock.length === 0 && <p className="erp-muted">No low stock items.</p>}</div>
          <div className="crm-card"><h3>Installation Queue</h3>{invoices.filter(item => item.approvalStatus === 'Approved').slice(0, 6).map(item => <div className="erp-alert-row" key={item._id}><span>{item.billNo}<small>{item.installationAssigneeName || item.engineerName}</small></span><strong>{item.installationStatus}</strong></div>)}</div>
        </div>
      </div>
    </div>
  )
}

export default function DispatchBillingDashboard() {
  return (
    <Provider store={billingStore}>
      <DispatchBillingInner />
    </Provider>
  )
}
