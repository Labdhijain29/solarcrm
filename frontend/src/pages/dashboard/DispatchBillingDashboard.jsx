import { configureStore, createSlice } from '@reduxjs/toolkit'
import jsPDF from 'jspdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FaBoxes, FaCheck, FaClipboardCheck, FaDownload, FaExclamationTriangle, FaEye, FaFileExcel, FaFileInvoice, FaFilePdf, FaMinus, FaPause, FaPlus, FaPrint, FaSearch, FaShippingFast, FaTools, FaTrash } from 'react-icons/fa'
import { Provider, useDispatch, useSelector } from 'react-redux'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import * as XLSX from 'xlsx'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import DispatchBillView from '../../components/dashboard/DispatchBillView'
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

const normalizeDashboardTab = (tab) => {
  if (tab === 'approvals') return 'approvals'
  if (tab === 'stock') return 'stock'
  if (tab === 'installation') return 'installation'
  return 'billing'
}

function DispatchBillingInner({ defaultTab = 'billing' }) {
  const { user } = useAuthStore()
  const dispatch = useDispatch()
  const { products, invoices, users, loading } = useSelector(state => state.dispatchBilling)
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const [productStockSearch, setProductStockSearch] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState(() => normalizeDashboardTab(defaultTab))
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const { register, control, reset, handleSubmit, getValues } = useForm({ defaultValues: emptyCustomer(user) })
  const calculated = useMemo(() => calculateLines(lines), [lines])
  const moduleCategoryOptions = useMemo(() => MODULE_GROUP_OPTIONS, [])
  const visibleProducts = useMemo(() => {
    const term = productStockSearch.trim().toLowerCase()
    return products
      .map((product) => {
        const selected = lines.find(line => line.productId === product._id)
        const selectedQuantity = Number(selected?.quantity || 0)
        return {
          ...product,
          selectedQuantity,
          availableAfterBill: Number(product.quantity || 0) - selectedQuantity,
        }
      })
      .filter((product) => {
        if (!term) return true
        return productSearchText(product).includes(term)
      })
      .sort((a, b) => Number(b.availableAfterBill || 0) - Number(a.availableAfterBill || 0) || String(a.name || '').localeCompare(String(b.name || '')))
  }, [lines, productStockSearch, products])

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
    setLines([])
    setProductStockSearch('')
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

  const addProductToBill = (product) => {
    if (Number(product.quantity || 0) <= 0) {
      toast.error('No stock available for this item')
      return
    }

    setLines(prev => {
      const existing = prev.find(line => line.productId === product._id)
      if (existing) {
        if (Number(existing.quantity || 0) + 1 > Number(product.quantity || 0)) {
          toast.error('Selected quantity cannot exceed available stock')
          return prev
        }
        return prev.map(line => line.productId === product._id ? { ...line, quantity: Number(line.quantity || 0) + 1 } : line)
      }

      return [...prev, { ...emptyLine(), ...selectProductPatch(product), quantity: 1 }]
    })
  }

  const changeBillQuantity = (productId, delta) => {
    const product = products.find(item => item._id === productId)
    setLines(prev => prev.flatMap((line) => {
      if (line.productId !== productId) return [line]
      const nextQuantity = Number(line.quantity || 0) + delta
      if (nextQuantity <= 0) return []
      if (product && nextQuantity > Number(product.quantity || 0)) {
        toast.error('Selected quantity cannot exceed available stock')
        return [line]
      }
      return [{ ...line, quantity: nextQuantity }]
    }))
  }

  const setBillQuantity = (productId, value) => {
    const product = products.find(item => item._id === productId)
    const nextQuantity = Number(value || 0)

    setLines(prev => prev.flatMap((line) => {
      if (line.productId !== productId) return [line]
      if (nextQuantity <= 0) return []
      if (product && nextQuantity > Number(product.quantity || 0)) {
        toast.error('Selected quantity cannot exceed available stock')
        return [{ ...line, quantity: Number(product.quantity || line.quantity || 1) }]
      }
      return [{ ...line, quantity: nextQuantity }]
    }))
  }

  const removeBillItem = (productId) => {
    setLines(prev => prev.filter(line => line.productId !== productId))
  }

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
    if (!String(form.customerName || '').trim()) return toast.error('Customer name required.')
    if (!String(form.mobile || '').trim()) return toast.error('Mobile number required.')
    if (!String(form.engineerName || '').trim()) return toast.error('Installation Manager required.')
    if (!String(form.siteAddress || '').trim()) return toast.error('Site address required.')
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

  const showSaveErrors = (errors) => {
    if (errors.customerName) return toast.error('Customer name required.')
    if (errors.mobile) return toast.error('Mobile number required.')
    if (errors.engineerName) return toast.error('Installation Manager required.')
    if (errors.siteAddress) return toast.error('Site address required.')
    toast.error('Please complete required bill details.')
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
  const lowStockAll = products.filter(product => Number(product.quantity || 0) <= Number(product.lowStockThreshold || 10))
  const outOfStock = products.filter(product => Number(product.quantity || 0) <= 0)
  const approvedInvoices = invoices.filter(item => item.approvalStatus === 'Approved')
  const installationQueue = approvedInvoices.filter(item => item.installationStatus !== 'Completed')
  const completedInstallations = approvedInvoices.filter(item => item.installationStatus === 'Completed')
  const stockValue = products.reduce((sum, product) => sum + (Number(product.quantity || 0) * Number(product.price || product.salePrice || 0)), 0)
  const workflowSteps = [
    { label: 'Bills Created', value: invoices.length, icon: <FaFileInvoice /> },
    { label: 'Pending Approval', value: pendingInvoices.length, icon: <FaClipboardCheck /> },
    { label: 'Sent to Installation', value: installationQueue.length, icon: <FaTools /> },
    { label: 'Completed', value: completedInstallations.length, icon: <FaCheck /> },
  ]
  const tabItems = [
    { id: 'billing', label: 'Billing', icon: <FaFileInvoice /> },
    { id: 'approvals', label: 'Approvals', icon: <FaClipboardCheck />, count: pendingInvoices.length },
    { id: 'stock', label: 'Stock Risk', icon: <FaBoxes />, count: lowStockAll.length },
    { id: 'installation', label: 'Installation', icon: <FaTools />, count: installationQueue.length },
  ]
  const installerOptions = users.map(person => ({ value: person.name, label: `${person.name} | ${person.role}` }))

  if (loading) return <Spinner />

  return (
    <div className="dashboard-page dispatch-erp-page">
      <PageHeader
        icon={<FaFileInvoice />}
        title="Dispatch Manager Billing"
        subtitle="Select stock items, create dispatch bills, approve handoff, and track installation."
        action={<div className="dashboard-inline-actions"><button className="btn btn-secondary" onClick={exportExcel}><FaFileExcel /> Export</button><button className="btn btn-ghost" onClick={printInvoice}><FaPrint /> Print</button></div>}
      />

      <div className="dashboard-grid-metrics">
        <MetricCard icon={<FaFileInvoice />} label="Total invoices" value={invoices.length} />
        <MetricCard icon={<FaShippingFast />} label="Pending dispatches" value={pendingInvoices.length} />
        <MetricCard icon={<FaCheck />} label="Approved bills" value={approvedInvoices.length} />
        <MetricCard icon={<FaExclamationTriangle />} label="Low stock alerts" value={lowStockAll.length} change={`${outOfStock.length} out of stock`} changeColor={outOfStock.length ? 'var(--red)' : undefined} />
      </div>

      <div className="crm-card dispatch-command-card">
        <div className="dispatch-workflow-rail">
          {workflowSteps.map((step, index) => (
            <div className="dispatch-workflow-step" key={step.label}>
              <div className="dispatch-workflow-icon">{step.icon}</div>
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              {index < workflowSteps.length - 1 && <i />}
            </div>
          ))}
        </div>
        <div className="dispatch-tab-bar">
          {tabItems.map(tab => (
            <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.icon}
              <span>{tab.label}</span>
              {Number(tab.count || 0) > 0 && <strong>{tab.count}</strong>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'billing' && <form className="crm-card erp-billing-card" onSubmit={handleSubmit(form => saveBill(form, 'Pending'))}>
        <div className="dashboard-split-row">
          <h3>Sales / Dispatch Invoice</h3>
          <div className="dashboard-inline-actions">
            <button type="button" className="btn btn-ghost" onClick={handleSubmit(form => saveBill(form, 'Draft'), showSaveErrors)}><FaDownload /> Draft</button>
            <button type="button" className="btn btn-secondary" onClick={handleSubmit(form => saveBill(form, 'Hold'), showSaveErrors)}><FaPause /> Hold</button>
            <button type="button" className="btn btn-secondary" onClick={() => createPdf()}><FaFilePdf /> PDF</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSubmit(form => saveBill(form, 'Pending'), showSaveErrors)}><FaCheck /> {saving ? 'Saving...' : 'Save Bill & Reserve Stock'}</button>
          </div>
        </div>

        <div className="dashboard-form-grid erp-head-grid">
          <div><label className="form-label">Bill No.</label><input className="crm-input" {...register('billNo', { required: true })} /></div>
          <div><label className="form-label">Date</label><input type="date" className="crm-input" {...register('dispatchDate')} /></div>
          <div><label className="form-label">Customer</label><input className="crm-input" {...register('customerName', { required: true })} placeholder="Customer search / name" /></div>
          <div><label className="form-label">Mobile</label><input className="crm-input" maxLength={10} {...register('mobile', { required: true })} /></div>
          <div><label className="form-label">GST No.</label><input className="crm-input" {...register('customerGst')} /></div>
          <div><label className="form-label">Lead / IVRS / Deal No.</label><input className="crm-input" maxLength={15} {...register('leadId')} /></div>
          <div><label className="form-label">Payment Mode</label><Controller name="paymentMode" control={control} render={({ field }) => <Select classNamePrefix="erp-select" options={PAYMENT_OPTIONS} value={PAYMENT_OPTIONS.find(item => item.value === field.value)} onChange={option => field.onChange(option.value)} />} /></div>
          <div><label className="form-label">Dispatch Status</label><Controller name="dispatchStatus" control={control} render={({ field }) => <Select classNamePrefix="erp-select" options={DISPATCH_OPTIONS} value={DISPATCH_OPTIONS.find(item => item.value === field.value)} onChange={option => field.onChange(option.value)} />} /></div>
          <div><label className="form-label">Installation Manager</label><Controller name="engineerName" control={control} rules={{ required: true }} render={({ field }) => {
            const selectedInstaller = field.value
              ? installerOptions.find(item => item.value === field.value) || { value: field.value, label: field.value }
              : null
            return (
              <CreatableSelect
                classNamePrefix="erp-select"
                options={installerOptions}
                value={selectedInstaller}
                onChange={option => field.onChange(option?.value || '')}
                onCreateOption={(value) => field.onChange(String(value || '').trim())}
                placeholder="Search or type installer name..."
                formatCreateLabel={(value) => `Use "${value}"`}
                isClearable
              />
            )
          }} /></div>
          <div><label className="form-label">Sales Person</label><input className="crm-input" {...register('salesPersonName')} /></div>
          <div style={{ gridColumn:'1/-1' }}><label className="form-label">Site Address</label><textarea rows={2} className="crm-input" {...register('siteAddress', { required: true })} /></div>
        </div>

        <div className="dispatch-builder-grid dispatch-billing-workspace">
          <aside className="crm-card-sm dispatch-stock-panel">
            <div className="dashboard-split-row" style={{ marginBottom:12 }}>
              <div>
                <h3 style={{ fontSize:15, fontWeight:700 }}>Stock Items</h3>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Select material to add it into this bill.</div>
              </div>
              <span className="badge badge-gray">{visibleProducts.length}</span>
            </div>
            <div className="dashboard-search" style={{ marginBottom:12 }}>
              <FaSearch />
              <input value={productStockSearch} onChange={event => setProductStockSearch(event.target.value)} placeholder="Search stock item..." />
            </div>
            <div className="dashboard-stack dispatch-stock-list">
              {visibleProducts.map((product) => (
                <button type="button" key={product._id} className="dispatch-stock-line" onClick={() => addProductToBill(product)} disabled={Number(product.availableAfterBill || 0) <= 0}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{[product.category, product.brand, product.type, product.capacity].filter(Boolean).join(' | ') || productCode(product)}</small>
                  </span>
                  <em className={Number(product.availableAfterBill || 0) <= 0 ? 'badge badge-red' : 'badge badge-green'}>
                    {Math.max(Number(product.availableAfterBill || 0), 0)} {product.unit || 'pcs'}
                  </em>
                </button>
              ))}
              {visibleProducts.length === 0 && <EmptyState title="No stock items found" />}
            </div>
          </aside>

          <section className="crm-card-sm">
            <div className="dashboard-split-row" style={{ marginBottom:16 }}>
              <div>
                <h3 style={{ fontSize:15, fontWeight:700 }}>Generated Bill</h3>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Selected stock items appear here automatically.</div>
              </div>
              <div className="dashboard-inline-actions">
                <span className="badge badge-sun">{calculated.lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} qty</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines([])} disabled={!lines.length}>Clear</button>
              </div>
            </div>

            {!calculated.lines.length ? (
              <EmptyState title="Bill is empty" subtitle="Left stock list se material select karein." />
            ) : (
              <div className="crm-table-wrap">
                <table className="crm-table dispatch-cart-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Discount</th><th>GST</th><th>Subtotal</th><th>Action</th></tr></thead>
                  <tbody>
                    {calculated.lines.map((line, index) => {
                      const product = products.find(productItem => productItem._id === line.productId)
                      const available = Number(product?.quantity ?? line.availableStock ?? 0)
                      const remainingAfterBill = Math.max(available - Number(line.quantity || 0), 0)

                      return (
                        <tr key={line.productId || line.lineId}>
                          <td>
                            <strong>{line.query || product?.name || 'Selected item'}</strong>
                            <div style={{ fontSize:11, color:'var(--muted)' }}>{[line.category || product?.category, line.brand || product?.brand, line.type || product?.type, line.capacity || product?.capacity].filter(Boolean).join(' | ')}</div>
                          </td>
                          <td>
                            <div className="dashboard-inline-actions dispatch-quantity-actions">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeBillQuantity(line.productId, -1)}><FaMinus /></button>
                              <input
                                className="crm-input"
                                type="number"
                                min="1"
                                max={available || undefined}
                                value={line.quantity}
                                onChange={event => setBillQuantity(line.productId, event.target.value)}
                                aria-label={`${line.query || product?.name || 'material'} dispatch quantity`}
                              />
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeBillQuantity(line.productId, 1)}><FaPlus /></button>
                            </div>
                            <div style={{ fontSize:11, color:Number(line.quantity || 0) > available ? 'var(--red)' : 'var(--muted)', marginTop:5 }}>
                              {line.unit || product?.unit || 'pcs'} | Available: {available} | Left: {remainingAfterBill}
                            </div>
                          </td>
                          <td>{money(line.price)}</td>
                          <td><input className="crm-input erp-cell-input" type="number" value={line.discountPercent} onChange={event => updateLine(index, { discountPercent: event.target.value })} /></td>
                          <td><input className="crm-input erp-cell-input" type="number" value={line.gstPercent} onChange={event => updateLine(index, { gstPercent: event.target.value })} /></td>
                          <td><strong>{money(line.amount)}</strong></td>
                          <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeBillItem(line.productId)}><FaTrash /> Remove</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="crm-mobile-cards">
                  {calculated.lines.map((line, index) => {
                    const product = products.find(productItem => productItem._id === line.productId)
                    const available = Number(product?.quantity ?? line.availableStock ?? 0)
                    const remainingAfterBill = Math.max(available - Number(line.quantity || 0), 0)

                    return (
                      <div key={line.productId || line.lineId} className="crm-mobile-card">
                        <div className="dashboard-split-row" style={{ marginBottom:10 }}>
                          <div style={{ minWidth:0 }}>
                            <strong>{line.query || product?.name || 'Selected item'}</strong>
                            <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{[line.category || product?.category, line.brand || product?.brand, line.type || product?.type, line.capacity || product?.capacity].filter(Boolean).join(' | ')}</div>
                          </div>
                          <span className="badge badge-sun">{money(line.amount)}</span>
                        </div>
                        <div className="dashboard-inline-actions dispatch-quantity-actions" style={{ marginBottom:8 }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeBillQuantity(line.productId, -1)}><FaMinus /></button>
                          <input className="crm-input" type="number" min="1" max={available || undefined} value={line.quantity} onChange={event => setBillQuantity(line.productId, event.target.value)} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeBillQuantity(line.productId, 1)}><FaPlus /></button>
                        </div>
                        <div className="crm-mobile-row"><span className="crm-mobile-label">Price</span><span>{money(line.price)}</span></div>
                        <div className="crm-mobile-row"><span className="crm-mobile-label">Stock</span><span>{line.unit || product?.unit || 'pcs'} | Available: {available} | Left: {remainingAfterBill}</span></div>
                        <div className="dashboard-mini-grid-2" style={{ marginTop:10 }}>
                          <label><span className="form-label">Discount</span><input className="crm-input" type="number" value={line.discountPercent} onChange={event => updateLine(index, { discountPercent: event.target.value })} /></label>
                          <label><span className="form-label">GST</span><input className="crm-input" type="number" value={line.gstPercent} onChange={event => updateLine(index, { gstPercent: event.target.value })} /></label>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={() => removeBillItem(line.productId)}><FaTrash /> Remove</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
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
            <button type="button" className="btn btn-primary dispatch-save-wide" disabled={saving || !lines.length} onClick={handleSubmit(form => saveBill(form, 'Pending'), showSaveErrors)}>
              <FaCheck /> {saving ? 'Saving...' : 'Save Bill & Reserve Stock'}
            </button>
          </div>
        </div>
      </form>}

      {(activeTab === 'billing' || activeTab === 'approvals') && <div className="dashboard-grid-sidebar" style={{ marginTop:16 }}>
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
                  <td className="dashboard-inline-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewingInvoice(invoice)}><FaEye /> View</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => createPdf(invoice)}><FaFilePdf /></button>
                    {invoice.approvalStatus === 'Pending' && <button className="btn btn-primary btn-sm" onClick={() => approveInvoice(invoice)}>Approve</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {filteredInvoices.length === 0 && <EmptyState title="No invoices found" subtitle="Create a bill or adjust filters." />}
          </div>
        </div>
        <div className="dashboard-stack">
          <div className="crm-card"><h3>Low Stock Alerts</h3>{lowStock.map(item => <div className="erp-alert-row" key={item._id}><span>{item.name}<small>{item.category}</small></span><strong>{item.quantity} {item.unit}</strong></div>)}{lowStock.length === 0 && <p className="erp-muted">No low stock items.</p>}</div>
          <div className="crm-card"><h3>Installation Queue</h3>{installationQueue.slice(0, 6).map(item => <div className="erp-alert-row" key={item._id}><span>{item.billNo}<small>{item.installationAssigneeName || item.engineerName}</small></span><strong>{item.installationStatus}</strong></div>)}{installationQueue.length === 0 && <p className="erp-muted">No pending installations.</p>}</div>
        </div>
      </div>}

      {activeTab === 'stock' && <div className="dashboard-grid-sidebar" style={{ marginTop:16 }}>
        <div className="crm-card">
          <div className="dashboard-split-row">
            <h3>Inventory Risk</h3>
            <span className="badge badge-sun">Estimated stock value {money(stockValue)}</span>
          </div>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Available</th><th>Threshold</th><th>Status</th></tr></thead>
              <tbody>{lowStockAll.map(product => (
                <tr key={product._id}>
                  <td><strong>{product.name}</strong><br /><small>{productCode(product)}</small></td>
                  <td>{product.category || '-'}</td>
                  <td>{product.brand || '-'}</td>
                  <td>{product.quantity || 0} {product.unit}</td>
                  <td>{product.lowStockThreshold || 10} {product.unit}</td>
                  <td><span className={`badge ${Number(product.quantity || 0) <= 0 ? 'badge-red' : 'badge-sun'}`}>{Number(product.quantity || 0) <= 0 ? 'Out of Stock' : 'Low Stock'}</span></td>
                </tr>
              ))}</tbody>
            </table>
            {lowStockAll.length === 0 && <EmptyState title="No stock risk" subtitle="All products are above their alert thresholds." />}
          </div>
        </div>
        <div className="dashboard-stack">
          <MetricCard icon={<FaBoxes />} label="Total SKUs" value={products.length} />
          <MetricCard icon={<FaExclamationTriangle />} label="Out of stock" value={outOfStock.length} change="Dispatch is blocked for unavailable rows" changeColor={outOfStock.length ? 'var(--red)' : undefined} />
        </div>
      </div>}

      {activeTab === 'installation' && <div className="crm-card" style={{ marginTop:16 }}>
        <div className="dashboard-split-row">
          <h3>Installation Handoff</h3>
          <span className="badge badge-green">{completedInstallations.length} completed</span>
        </div>
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr><th>Bill</th><th>Customer</th><th>Installation Manager</th><th>Dispatch</th><th>Installation</th><th>Amount</th><th>Invoice</th></tr></thead>
            <tbody>{approvedInvoices.map(invoice => (
              <tr key={invoice._id}>
                <td><strong>{invoice.billNo}</strong><br /><small>{new Date(invoice.dispatchDate || invoice.createdAt).toLocaleDateString('en-IN')}</small></td>
                <td>{invoice.customerName}<br /><small>{invoice.mobile}</small></td>
                <td>{invoice.installationAssigneeName || invoice.engineerName || '-'}</td>
                <td>{invoice.dispatchStatus || '-'}</td>
                <td><span className={`badge ${invoice.installationStatus === 'Completed' ? 'badge-green' : invoice.installationStatus === 'In Progress' ? 'badge-sun' : 'badge-gray'}`}>{invoice.installationStatus || 'Pending'}</span></td>
                <td>{money(invoice.payableAmount || invoice.grandTotal)}</td>
                <td className="dashboard-inline-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewingInvoice(invoice)}><FaEye /> View</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => createPdf(invoice)}><FaFilePdf /> PDF</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {approvedInvoices.length === 0 && <EmptyState title="No approved dispatches" subtitle="Approve a pending bill to send it for installation." />}
        </div>
      </div>}

      {viewingInvoice && (
        <DispatchBillView dispatch={viewingInvoice} onClose={() => setViewingInvoice(null)}>
          <button className="btn btn-ghost btn-sm" onClick={() => createPdf(viewingInvoice)}><FaFilePdf /> PDF</button>
          {viewingInvoice.approvalStatus === 'Pending' && <button className="btn btn-primary btn-sm" onClick={() => approveInvoice(viewingInvoice)}>Approve</button>}
        </DispatchBillView>
      )}
    </div>
  )
}

export default function DispatchBillingDashboard({ defaultTab = 'billing' }) {
  return (
    <Provider store={billingStore}>
      <DispatchBillingInner defaultTab={defaultTab} />
    </Provider>
  )
}
