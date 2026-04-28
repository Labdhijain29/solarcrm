import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FaBoxOpen, FaChartBar, FaDownload, FaExclamationTriangle, FaFilePdf, FaPlus, FaSearch, FaShippingFast, FaTrash, FaWarehouse } from 'react-icons/fa'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dispatchAPI, leadsAPI, productAPI } from '../../services/api'
import { EmptyState, MetricCard, PageHeader, Spinner } from '../../components/common'
import LeadModal from '../../components/dashboard/LeadModal'
import { useAuthStore } from '../../store'

const MODULE_CATEGORY = 'MODULE'
const LEGACY_MODULE_CATEGORY = 'SOLAR PANELS'
const INVERTER_CATEGORY = 'INVERTER (ON-GRID)'
const AC_DC_CATEGORY = 'AC/DC BOX'
const CABLE_TRY_CATEGORY = 'CABLE TRY'
const STRUCTURE_CATEGORY = 'STRUCTURE'
const HEAD_PARLIN_CATEGORY = 'HEAD PARLIN'
const C_CHANNEL_CATEGORY = 'C CHANNEL'
const BASE_PLATE_CATEGORY = 'BASE PLATE'
const FASTNER_CATEGORY = 'FASTNER'
const SS_NUT_BOLT_CATEGORY = 'SS NUT BOLT'
const EARTHING_KIT_CATEGORY = 'EARTHING KIT'
const PIPE_CATEGORY = 'PIPE'
const ALBA_CATEGORY = 'ALBA'
const TE_CATEGORY = 'TE'
const DCR_GROUP = 'DCR'
const INVERTER_GROUP = 'INVERTER_ON_GRID'
const AC_DC_GROUP = 'AC_DC_BOX'
const CABLE_TRY_GROUP = 'CABLE_TRY'
const STRUCTURE_GROUP = 'STRUCTURE'
const HEAD_PARLIN_GROUP = 'HEAD_PARLIN'
const C_CHANNEL_GROUP = 'C_CHANNEL'
const BASE_PLATE_GROUP = 'BASE_PLATE'
const FASTNER_GROUP = 'FASTNER'
const SS_NUT_BOLT_GROUP = 'SS_NUT_BOLT'
const EARTHING_KIT_GROUP = 'EARTHING_KIT'
const PIPE_GROUP = 'PIPE'
const ALBA_GROUP = 'ALBA'
const TE_GROUP = 'TE'
const MODULE_BRANDS = ['Warree', 'Adani', 'Tata']
const MODULE_TYPES = {
  'DCR P-Type': ['530WP', '535WP', '540WP', '545WP', '550WP'],
  'N-Type TOPCon': ['560WP', '565WP', '570WP', '575WP', '580WP', '585WP'],
}
const INVERTER_BRANDS = ['Warree', 'Luminious', 'Polycab', 'Sungrow', 'Sunbase']
const INVERTER_CAPACITIES = ['3kw', '4kw', '5kw', '6kw', '7kw', '8kw', '9kw', '10kw', '15kw']
const AC_DC_BRANDS = ['Havells', 'Simons']
const AC_DC_PHASES = ['Single Phase', 'Three Phase']
const CABLE_TRY_ITEMS = ['Cable Try']
const STRUCTURE_BRANDS = ['JSW']
const STRUCTURE_SIZE = '140*50*2mm'
const STRUCTURE_FEET = ['6.5feet', '8.5feet', '13 feet']
const makeStructureVariant = (feet) => `${STRUCTURE_SIZE} | ${feet}`
const getStructureFeet = (variant) => String(variant || '').split('|').pop().trim()
const HEAD_PARLIN_SIZE = '70*50*1.5mm'
const HEAD_PARLIN_FEET = ['21 feet', '13 feet']
const makeHeadParlinVariant = (feet) => `${HEAD_PARLIN_SIZE} | ${feet}`
const getHeadParlinFeet = (variant) => String(variant || '').split('|').pop().trim()
const C_CHANNEL_SIZE = '41*41mm'
const C_CHANNEL_FEET = ['10.5feet', '21 feet']
const makeCChannelVariant = (feet) => `${C_CHANNEL_SIZE} | ${feet}`
const getCChannelFeet = (variant) => String(variant || '').split('|').pop().trim()
const BASE_PLATE_SIZES = ['140*50', '80*40']
const FASTNER_SIZES = ['10*100']
const SS_NUT_BOLT_SIZES = ['8*25 SS', '10*25 SS', '10*25 gi']
const EARTHING_KIT_SIZES = ['17*1 Mtr', 'LA 17*1 mtr']
const PIPE_SIZES = ['10*25']
const ALBA_SIZES = ['10*25']
const TE_SIZES = ['10*25']
const STOCK_CATEGORY_OPTIONS = Object.keys({
  [MODULE_CATEGORY]: true,
  [INVERTER_CATEGORY]: true,
  [AC_DC_CATEGORY]: true,
  [CABLE_TRY_CATEGORY]: true,
  [STRUCTURE_CATEGORY]: true,
  [HEAD_PARLIN_CATEGORY]: true,
  [C_CHANNEL_CATEGORY]: true,
  [BASE_PLATE_CATEGORY]: true,
  [FASTNER_CATEGORY]: true,
  [SS_NUT_BOLT_CATEGORY]: true,
  [EARTHING_KIT_CATEGORY]: true,
  [PIPE_CATEGORY]: true,
  [ALBA_CATEGORY]: true,
  [TE_CATEGORY]: true,
  CABLE: true,
  'STRUCTURE MATERIAL': true,
  'EARTHING & SAFETY': true,
})
const getCategoryLabel = (category) => category === MODULE_CATEGORY ? 'Module' : category

const CATEGORIES = {
  [MODULE_CATEGORY]: {
    brands: MODULE_BRANDS,
    types: {
      ...MODULE_TYPES,
    },
    unit: 'pcs',
  },
  [LEGACY_MODULE_CATEGORY]: {
    brands: MODULE_BRANDS,
    types: {
      ...MODULE_TYPES,
    },
    unit: 'pcs',
  },
  [INVERTER_CATEGORY]: {
    brands: INVERTER_BRANDS,
    types: { Capacity: INVERTER_CAPACITIES },
    unit: 'pcs',
  },
  [AC_DC_CATEGORY]: {
    brands: AC_DC_BRANDS,
    types: { Phase: AC_DC_PHASES },
    unit: 'pcs',
  },
  [CABLE_TRY_CATEGORY]: {
    brands: [],
    types: { Item: CABLE_TRY_ITEMS },
    unit: 'pcs',
  },
  [STRUCTURE_CATEGORY]: {
    brands: STRUCTURE_BRANDS,
    types: { Size: STRUCTURE_FEET.map(makeStructureVariant) },
    unit: 'pcs',
  },
  [HEAD_PARLIN_CATEGORY]: {
    brands: [],
    types: { Size: HEAD_PARLIN_FEET.map(makeHeadParlinVariant) },
    unit: 'pcs',
  },
  [C_CHANNEL_CATEGORY]: {
    brands: [],
    types: { Size: C_CHANNEL_FEET.map(makeCChannelVariant) },
    unit: 'pcs',
  },
  [BASE_PLATE_CATEGORY]: {
    brands: [],
    types: { Size: BASE_PLATE_SIZES },
    unit: 'pcs',
  },
  [FASTNER_CATEGORY]: {
    brands: [],
    types: { Size: FASTNER_SIZES },
    unit: 'pcs',
  },
  [SS_NUT_BOLT_CATEGORY]: {
    brands: [],
    types: { Size: SS_NUT_BOLT_SIZES },
    unit: 'pcs',
  },
  [EARTHING_KIT_CATEGORY]: {
    brands: [],
    types: { Size: EARTHING_KIT_SIZES },
    unit: 'pcs',
  },
  [PIPE_CATEGORY]: {
    brands: [],
    types: { Size: PIPE_SIZES },
    unit: 'pcs',
  },
  [ALBA_CATEGORY]: {
    brands: [],
    types: { Size: ALBA_SIZES },
    unit: 'pcs',
  },
  [TE_CATEGORY]: {
    brands: [],
    types: { Size: TE_SIZES },
    unit: 'pcs',
  },
  CABLE: {
    brands: [],
    types: { Type: ['DC Cable', 'AC Cable', 'Earthing Cable', 'Solar Cable'] },
    unit: 'mtr',
  },
  'STRUCTURE MATERIAL': {
    brands: [],
    types: { Item: ['C Channel', 'Head Purlin', 'JSW Structure', 'Base Plate', 'Fasteners', 'Nut Bolt 10x100', 'Nut Bolt 8x25', 'Nut Bolt 10x25'] },
    unit: 'pcs',
  },
  'EARTHING & SAFETY': {
    brands: [],
    types: { Item: ['Earthing Kit 17x1 mtr', 'LA Lightning Arrestor', 'Pipe', 'Alba', 'T 10x25'] },
    unit: 'pcs',
  },
}

const emptyProduct = {
  name: '',
  category: MODULE_CATEGORY,
  subCategory: '',
  brand: '',
  type: 'DCR P-Type',
  capacity: '530WP',
  quantity: '',
  unit: 'pcs',
  lowStockThreshold: 10,
}

const getDispatchModuleType = (item) => item.moduleType === 'N-Type' ? 'N-Type TOPCon' : 'DCR P-Type'
const getDispatchCapacityOptions = (item) => {
  if (item.moduleGroup === INVERTER_GROUP) return INVERTER_CAPACITIES
  if (item.moduleGroup === AC_DC_GROUP) return AC_DC_PHASES
  if (item.moduleGroup === CABLE_TRY_GROUP) return CABLE_TRY_ITEMS
  if (item.moduleGroup === STRUCTURE_GROUP) return STRUCTURE_FEET.map(makeStructureVariant)
  if (item.moduleGroup === HEAD_PARLIN_GROUP) return HEAD_PARLIN_FEET.map(makeHeadParlinVariant)
  if (item.moduleGroup === C_CHANNEL_GROUP) return C_CHANNEL_FEET.map(makeCChannelVariant)
  if (item.moduleGroup === BASE_PLATE_GROUP) return BASE_PLATE_SIZES
  if (item.moduleGroup === FASTNER_GROUP) return FASTNER_SIZES
  if (item.moduleGroup === SS_NUT_BOLT_GROUP) return SS_NUT_BOLT_SIZES
  if (item.moduleGroup === EARTHING_KIT_GROUP) return EARTHING_KIT_SIZES
  if (item.moduleGroup === PIPE_GROUP) return PIPE_SIZES
  if (item.moduleGroup === ALBA_GROUP) return ALBA_SIZES
  if (item.moduleGroup === TE_GROUP) return TE_SIZES
  return MODULE_TYPES[getDispatchModuleType(item)] || []
}
const getDispatchBrandOptions = (item) => {
  if (item.moduleGroup === INVERTER_GROUP) return INVERTER_BRANDS
  if (item.moduleGroup === AC_DC_GROUP) return AC_DC_BRANDS
  if (item.moduleGroup === CABLE_TRY_GROUP) return []
  if (item.moduleGroup === STRUCTURE_GROUP) return STRUCTURE_BRANDS
  if (item.moduleGroup === HEAD_PARLIN_GROUP) return []
  if (item.moduleGroup === C_CHANNEL_GROUP) return []
  if (item.moduleGroup === BASE_PLATE_GROUP) return []
  if (item.moduleGroup === FASTNER_GROUP) return []
  if (item.moduleGroup === SS_NUT_BOLT_GROUP) return []
  if (item.moduleGroup === EARTHING_KIT_GROUP) return []
  if (item.moduleGroup === PIPE_GROUP) return []
  if (item.moduleGroup === ALBA_GROUP) return []
  if (item.moduleGroup === TE_GROUP) return []
  return MODULE_BRANDS
}
const getProductModuleKind = (type) => type === 'N-Type TOPCon' ? 'N-Type' : 'P-Type'
const getProductGroup = (productForm) => {
  if (productForm.category === INVERTER_CATEGORY) return INVERTER_GROUP
  if (productForm.category === AC_DC_CATEGORY) return AC_DC_GROUP
  if (productForm.category === CABLE_TRY_CATEGORY) return CABLE_TRY_GROUP
  if (productForm.category === STRUCTURE_CATEGORY) return STRUCTURE_GROUP
  if (productForm.category === HEAD_PARLIN_CATEGORY) return HEAD_PARLIN_GROUP
  if (productForm.category === C_CHANNEL_CATEGORY) return C_CHANNEL_GROUP
  if (productForm.category === BASE_PLATE_CATEGORY) return BASE_PLATE_GROUP
  if (productForm.category === FASTNER_CATEGORY) return FASTNER_GROUP
  if (productForm.category === SS_NUT_BOLT_CATEGORY) return SS_NUT_BOLT_GROUP
  if (productForm.category === EARTHING_KIT_CATEGORY) return EARTHING_KIT_GROUP
  if (productForm.category === PIPE_CATEGORY) return PIPE_GROUP
  if (productForm.category === ALBA_CATEGORY) return ALBA_GROUP
  if (productForm.category === TE_CATEGORY) return TE_GROUP
  return DCR_GROUP
}
const getProductCapacityOptions = (productForm) => {
  if (getProductGroup(productForm) === INVERTER_GROUP) return INVERTER_CAPACITIES
  if (getProductGroup(productForm) === AC_DC_GROUP) return AC_DC_PHASES
  if (getProductGroup(productForm) === CABLE_TRY_GROUP) return CABLE_TRY_ITEMS
  if (getProductGroup(productForm) === STRUCTURE_GROUP) return STRUCTURE_FEET.map(makeStructureVariant)
  if (getProductGroup(productForm) === HEAD_PARLIN_GROUP) return HEAD_PARLIN_FEET.map(makeHeadParlinVariant)
  if (getProductGroup(productForm) === C_CHANNEL_GROUP) return C_CHANNEL_FEET.map(makeCChannelVariant)
  if (getProductGroup(productForm) === BASE_PLATE_GROUP) return BASE_PLATE_SIZES
  if (getProductGroup(productForm) === FASTNER_GROUP) return FASTNER_SIZES
  if (getProductGroup(productForm) === SS_NUT_BOLT_GROUP) return SS_NUT_BOLT_SIZES
  if (getProductGroup(productForm) === EARTHING_KIT_GROUP) return EARTHING_KIT_SIZES
  if (getProductGroup(productForm) === PIPE_GROUP) return PIPE_SIZES
  if (getProductGroup(productForm) === ALBA_GROUP) return ALBA_SIZES
  if (getProductGroup(productForm) === TE_GROUP) return TE_SIZES
  return MODULE_TYPES[productForm.type] || []
}
const getProductBrandOptions = (productForm) => {
  if (getProductGroup(productForm) === INVERTER_GROUP) return INVERTER_BRANDS
  if (getProductGroup(productForm) === AC_DC_GROUP) return AC_DC_BRANDS
  if (getProductGroup(productForm) === CABLE_TRY_GROUP) return []
  if (getProductGroup(productForm) === STRUCTURE_GROUP) return STRUCTURE_BRANDS
  if (getProductGroup(productForm) === HEAD_PARLIN_GROUP) return []
  if (getProductGroup(productForm) === C_CHANNEL_GROUP) return []
  if (getProductGroup(productForm) === BASE_PLATE_GROUP) return []
  if (getProductGroup(productForm) === FASTNER_GROUP) return []
  if (getProductGroup(productForm) === SS_NUT_BOLT_GROUP) return []
  if (getProductGroup(productForm) === EARTHING_KIT_GROUP) return []
  if (getProductGroup(productForm) === PIPE_GROUP) return []
  if (getProductGroup(productForm) === ALBA_GROUP) return []
  if (getProductGroup(productForm) === TE_GROUP) return []
  return MODULE_BRANDS
}
const normalizeModuleValue = (value) => String(value || '').replace(/\s+/g, '').toLowerCase()
const normalizeModuleBrand = (value) => normalizeModuleValue(value).replace('waaree', 'warree').replace('luminous', 'luminious')
const normalizeModuleType = (value) => String(value || '') === 'N-Type' ? 'N-Type TOPCon' : String(value || '')
const isModuleCategory = (category) => [MODULE_CATEGORY, LEGACY_MODULE_CATEGORY].includes(category)
const isModuleProduct = (product) => isModuleCategory(product.category)
const isInverterProduct = (product) => product.category === INVERTER_CATEGORY
const isAcDcProduct = (product) => product.category === AC_DC_CATEGORY
const isCableTryProduct = (product) => product.category === CABLE_TRY_CATEGORY
const isStructureProduct = (product) => product.category === STRUCTURE_CATEGORY
const isHeadParlinProduct = (product) => product.category === HEAD_PARLIN_CATEGORY
const isCChannelProduct = (product) => product.category === C_CHANNEL_CATEGORY
const isBasePlateProduct = (product) => product.category === BASE_PLATE_CATEGORY
const isFastnerProduct = (product) => product.category === FASTNER_CATEGORY
const isSsNutBoltProduct = (product) => product.category === SS_NUT_BOLT_CATEGORY
const isEarthingKitProduct = (product) => product.category === EARTHING_KIT_CATEGORY
const isPipeProduct = (product) => product.category === PIPE_CATEGORY
const isAlbaProduct = (product) => product.category === ALBA_CATEGORY
const isTeProduct = (product) => product.category === TE_CATEGORY
const isStructuredCategory = (category) => isModuleCategory(category) || category === INVERTER_CATEGORY || category === AC_DC_CATEGORY || category === CABLE_TRY_CATEGORY || category === STRUCTURE_CATEGORY || category === HEAD_PARLIN_CATEGORY || category === C_CHANNEL_CATEGORY || category === BASE_PLATE_CATEGORY || category === FASTNER_CATEGORY || category === SS_NUT_BOLT_CATEGORY || category === EARTHING_KIT_CATEGORY || category === PIPE_CATEGORY || category === ALBA_CATEGORY || category === TE_CATEGORY
const makeDispatchItem = () => ({
  category: MODULE_CATEGORY,
  moduleGroup: DCR_GROUP,
  moduleType: 'P-Type',
  technology: '',
  capacity: MODULE_TYPES['DCR P-Type'][0],
  brand: MODULE_BRANDS[0],
  productId: '',
  quantity: 1,
})

const matchesDispatchModule = (product, item) => {
  if (item.moduleGroup === INVERTER_GROUP) {
    if (!isInverterProduct(product)) return false
    return normalizeModuleType(product.type) === 'Capacity' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity) &&
      normalizeModuleBrand(product.brand) === normalizeModuleBrand(item.brand)
  }
  if (item.moduleGroup === AC_DC_GROUP) {
    if (!isAcDcProduct(product)) return false
    return normalizeModuleType(product.type) === 'Phase' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity) &&
      normalizeModuleBrand(product.brand) === normalizeModuleBrand(item.brand)
  }
  if (item.moduleGroup === CABLE_TRY_GROUP) {
    if (!isCableTryProduct(product)) return false
    return normalizeModuleType(product.type) === 'Item' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === STRUCTURE_GROUP) {
    if (!isStructureProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity) &&
      normalizeModuleBrand(product.brand) === normalizeModuleBrand(item.brand)
  }
  if (item.moduleGroup === HEAD_PARLIN_GROUP) {
    if (!isHeadParlinProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === C_CHANNEL_GROUP) {
    if (!isCChannelProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === BASE_PLATE_GROUP) {
    if (!isBasePlateProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === FASTNER_GROUP) {
    if (!isFastnerProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === SS_NUT_BOLT_GROUP) {
    if (!isSsNutBoltProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === EARTHING_KIT_GROUP) {
    if (!isEarthingKitProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === PIPE_GROUP) {
    if (!isPipeProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === ALBA_GROUP) {
    if (!isAlbaProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (item.moduleGroup === TE_GROUP) {
    if (!isTeProduct(product)) return false
    return normalizeModuleType(product.type) === 'Size' &&
      normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity)
  }
  if (!isModuleProduct(product)) return false
  return normalizeModuleType(product.type) === getDispatchModuleType(item) &&
    normalizeModuleValue(product.capacity) === normalizeModuleValue(item.capacity) &&
    normalizeModuleBrand(product.brand) === normalizeModuleBrand(item.brand)
}

const emptyDispatch = {
  customerName: '',
  leadId: '',
  engineerName: '',
  siteAddress: '',
  mobile: '',
  dispatchDate: new Date().toISOString().slice(0, 10),
  items: [makeDispatchItem()],
}

const statusClass = (product) => Number(product.quantity || 0) < Number(product.lowStockThreshold || 10) ? 'badge-red' : 'badge-green'
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-'
const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '').slice(0, 10)

export default function InventoryDispatchPage({ defaultTab = 'dashboard' }) {
  const { user } = useAuthStore()
  const [tab, setTab] = useState(defaultTab)
  const [products, setProducts] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [dispatchLeads, setDispatchLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false)
  const [dispatchForm, setDispatchForm] = useState(emptyDispatch)
  const [filters, setFilters] = useState({ search: '', category: '' })
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)

  const canManageStock = ['Admin', 'Stock Manager'].includes(user?.role)
  const canDispatch = ['Admin', 'Dispatch Manager'].includes(user?.role)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      productAPI.getAll(filters),
      dispatchAPI.getAll(),
      productAPI.getStats(),
      leadsAPI.getAll({ stage: 'Dispatch' }),
    ])
      .then(([productRes, dispatchRes, statsRes, leadRes]) => {
        setProducts(productRes.data.data || [])
        setDispatches(dispatchRes.data.data || [])
        setStats(statsRes.data.data || null)
        setDispatchLeads(leadRes.data.data || [])
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Inventory load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [filters.category])

  useEffect(() => {
    const id = setTimeout(loadData, 300)
    return () => clearTimeout(id)
  }, [filters.search])

  const summary = useMemo(() => ({
    totalItems: stats?.totalItems ?? products.length,
    totalQuantity: stats?.totalQuantity ?? products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    lowStockCount: stats?.lowStockCount ?? products.filter(item => Number(item.quantity || 0) < Number(item.lowStockThreshold || 10)).length,
    totalDispatched: stats?.totalDispatched ?? dispatches.reduce((sum, dispatch) => sum + dispatch.items.reduce((inner, item) => inner + Number(item.quantity || 0), 0), 0),
  }), [dispatches, products, stats])

  const chartData = useMemo(() => {
    const dispatchMap = Object.fromEntries((stats?.categoryDispatch || []).map(item => [item.name, item.quantity]))
    return (stats?.categoryStock || []).map(item => ({
      name: item.name,
      stock: item.quantity,
      dispatched: dispatchMap[item.name] || 0,
    }))
  }, [stats])

  const leadDispatches = useMemo(() => {
    if (!leadSearch.trim()) return []
    const term = leadSearch.trim().toLowerCase()
    return dispatches.filter(item =>
      String(item.leadId || '').toLowerCase().includes(term) ||
      String(item.customerName || '').toLowerCase().includes(term) ||
      String(item.mobile || '').includes(term)
    )
  }, [dispatches, leadSearch])

  const activeDispatchLeads = useMemo(
    () => dispatchLeads.filter(lead => lead.status === 'active' && lead.currentStage === 'Dispatch'),
    [dispatchLeads]
  )

  const setProductField = (key, value) => {
    setProductForm((prev) => {
      if (key === 'category') {
        const nextCategory = CATEGORIES[value] || CATEGORIES[MODULE_CATEGORY]
        const firstType = Object.keys(nextCategory.types)[0] || ''
        const firstCapacity = nextCategory.types[firstType]?.[0] || ''
        return { ...prev, category: value, brand: nextCategory.brands[0] || '', type: firstType, capacity: firstCapacity, unit: nextCategory.unit }
      }
      if (key === 'type') {
        const capacity = CATEGORIES[prev.category]?.types?.[value]?.[0] || ''
        return { ...prev, type: value, capacity }
      }
      if (key === 'moduleKind') {
        const type = value === 'N-Type' ? 'N-Type TOPCon' : 'DCR P-Type'
        const capacity = CATEGORIES[prev.category]?.types?.[type]?.[0] || ''
        return { ...prev, type, capacity }
      }
      if (key === 'moduleGroup') {
        if (value === INVERTER_GROUP) {
          return { ...prev, category: INVERTER_CATEGORY, brand: INVERTER_BRANDS[0], type: 'Capacity', capacity: INVERTER_CAPACITIES[0], unit: 'pcs' }
        }
        if (value === AC_DC_GROUP) {
          return { ...prev, category: AC_DC_CATEGORY, brand: AC_DC_BRANDS[0], type: 'Phase', capacity: AC_DC_PHASES[0], unit: 'pcs' }
        }
        if (value === CABLE_TRY_GROUP) {
          return { ...prev, category: CABLE_TRY_CATEGORY, brand: '', type: 'Item', capacity: CABLE_TRY_ITEMS[0], unit: 'pcs' }
        }
        if (value === STRUCTURE_GROUP) {
          return { ...prev, category: STRUCTURE_CATEGORY, brand: STRUCTURE_BRANDS[0], type: 'Size', capacity: makeStructureVariant(STRUCTURE_FEET[0]), unit: 'pcs' }
        }
        if (value === HEAD_PARLIN_GROUP) {
          return { ...prev, category: HEAD_PARLIN_CATEGORY, brand: '', type: 'Size', capacity: makeHeadParlinVariant(HEAD_PARLIN_FEET[0]), unit: 'pcs' }
        }
        if (value === C_CHANNEL_GROUP) {
          return { ...prev, category: C_CHANNEL_CATEGORY, brand: '', type: 'Size', capacity: makeCChannelVariant(C_CHANNEL_FEET[0]), unit: 'pcs' }
        }
        if (value === BASE_PLATE_GROUP) {
          return { ...prev, category: BASE_PLATE_CATEGORY, brand: '', type: 'Size', capacity: BASE_PLATE_SIZES[0], unit: 'pcs' }
        }
        if (value === FASTNER_GROUP) {
          return { ...prev, category: FASTNER_CATEGORY, brand: '', type: 'Size', capacity: FASTNER_SIZES[0], unit: 'pcs' }
        }
        if (value === SS_NUT_BOLT_GROUP) {
          return { ...prev, category: SS_NUT_BOLT_CATEGORY, brand: '', type: 'Size', capacity: SS_NUT_BOLT_SIZES[0], unit: 'pcs' }
        }
        if (value === EARTHING_KIT_GROUP) {
          return { ...prev, category: EARTHING_KIT_CATEGORY, brand: '', type: 'Size', capacity: EARTHING_KIT_SIZES[0], unit: 'pcs' }
        }
        if (value === PIPE_GROUP) {
          return { ...prev, category: PIPE_CATEGORY, brand: '', type: 'Size', capacity: PIPE_SIZES[0], unit: 'pcs' }
        }
        if (value === ALBA_GROUP) {
          return { ...prev, category: ALBA_CATEGORY, brand: '', type: 'Size', capacity: ALBA_SIZES[0], unit: 'pcs' }
        }
        if (value === TE_GROUP) {
          return { ...prev, category: TE_CATEGORY, brand: '', type: 'Size', capacity: TE_SIZES[0], unit: 'pcs' }
        }
        return { ...prev, category: MODULE_CATEGORY, brand: MODULE_BRANDS[0], type: 'DCR P-Type', capacity: MODULE_TYPES['DCR P-Type'][0], unit: 'pcs' }
      }
      return { ...prev, [key]: value }
    })
  }

  const openCreateProduct = () => {
    setEditingProduct(null)
    setProductForm({ ...emptyProduct, brand: CATEGORIES[emptyProduct.category].brands[0] })
    setProductFormOpen(true)
  }

  const openEditProduct = (product) => {
    setEditingProduct(product)
    const moduleProduct = isModuleProduct(product)
    const inverterProduct = isInverterProduct(product)
    const acDcProduct = isAcDcProduct(product)
    const cableTryProduct = isCableTryProduct(product)
    const structureProduct = isStructureProduct(product)
    const headParlinProduct = isHeadParlinProduct(product)
    const cChannelProduct = isCChannelProduct(product)
    const basePlateProduct = isBasePlateProduct(product)
    const fastnerProduct = isFastnerProduct(product)
    const ssNutBoltProduct = isSsNutBoltProduct(product)
    const earthingKitProduct = isEarthingKitProduct(product)
    const pipeProduct = isPipeProduct(product)
    const albaProduct = isAlbaProduct(product)
    const teProduct = isTeProduct(product)
    const structuredCategory = inverterProduct ? INVERTER_CATEGORY : acDcProduct ? AC_DC_CATEGORY : cableTryProduct ? CABLE_TRY_CATEGORY : structureProduct ? STRUCTURE_CATEGORY : headParlinProduct ? HEAD_PARLIN_CATEGORY : cChannelProduct ? C_CHANNEL_CATEGORY : basePlateProduct ? BASE_PLATE_CATEGORY : fastnerProduct ? FASTNER_CATEGORY : ssNutBoltProduct ? SS_NUT_BOLT_CATEGORY : earthingKitProduct ? EARTHING_KIT_CATEGORY : pipeProduct ? PIPE_CATEGORY : albaProduct ? ALBA_CATEGORY : teProduct ? TE_CATEGORY : MODULE_CATEGORY
    const structuredType = moduleProduct ? normalizeModuleType(product.type || 'DCR P-Type') : inverterProduct ? 'Capacity' : acDcProduct ? 'Phase' : cableTryProduct ? 'Item' : structureProduct || headParlinProduct || cChannelProduct || basePlateProduct || fastnerProduct || ssNutBoltProduct || earthingKitProduct || pipeProduct || albaProduct || teProduct ? 'Size' : product.type || ''
    const structuredBrands = getProductBrandOptions({ category: structuredCategory })
    const structuredCapacities = getProductCapacityOptions({ category: structuredCategory, type: structuredType })
    setProductForm({
      name: product.name || '',
      category: moduleProduct ? MODULE_CATEGORY : product.category || MODULE_CATEGORY,
      subCategory: product.subCategory || '',
      brand: moduleProduct || inverterProduct || acDcProduct || cableTryProduct || structureProduct || headParlinProduct || cChannelProduct || basePlateProduct || fastnerProduct || ssNutBoltProduct || earthingKitProduct || pipeProduct || albaProduct || teProduct ? structuredBrands.find(brand => normalizeModuleBrand(brand) === normalizeModuleBrand(product.brand)) || product.brand || structuredBrands[0] || '' : product.brand || '',
      type: structuredType,
      capacity: moduleProduct || inverterProduct || acDcProduct || cableTryProduct || structureProduct || headParlinProduct || cChannelProduct || basePlateProduct || fastnerProduct || ssNutBoltProduct || earthingKitProduct || pipeProduct || albaProduct || teProduct ? structuredCapacities.find(capacity => normalizeModuleValue(capacity) === normalizeModuleValue(product.capacity)) || product.capacity || structuredCapacities[0] : product.capacity || '',
      quantity: product.quantity ?? 0,
      unit: product.unit || 'pcs',
      lowStockThreshold: product.lowStockThreshold ?? 10,
    })
    setProductFormOpen(true)
  }

  const saveProduct = async (e) => {
    e.preventDefault()
    const payload = {
      ...productForm,
      name: productForm.name.trim() || [productForm.brand, productForm.type, productForm.capacity].filter(Boolean).join(' '),
      quantity: Number(productForm.quantity || 0),
      lowStockThreshold: Number(productForm.lowStockThreshold || 10),
    }
    try {
      if (editingProduct) await productAPI.update(editingProduct._id, payload)
      else await productAPI.create(payload)
      toast.success(editingProduct ? 'Stock updated' : 'Item added')
      setProductFormOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Product save failed')
    }
  }

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return
    try {
      await productAPI.delete(product._id)
      toast.success('Item deleted')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const updateDispatchItem = (index, key, value) => {
    setDispatchForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (key === 'moduleType') {
          const nextItem = { ...item, moduleType: value, technology: value === 'N-Type' ? 'TOPCon' : '', productId: '' }
          return { ...nextItem, capacity: getDispatchCapacityOptions(nextItem)[0] || '' }
        }
        if (key === 'moduleGroup') {
          if (value === INVERTER_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: INVERTER_BRANDS[0], capacity: INVERTER_CAPACITIES[0], productId: '' }
          }
          if (value === AC_DC_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: AC_DC_BRANDS[0], capacity: AC_DC_PHASES[0], productId: '' }
          }
          if (value === CABLE_TRY_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: CABLE_TRY_ITEMS[0], productId: '' }
          }
          if (value === STRUCTURE_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: STRUCTURE_BRANDS[0], capacity: makeStructureVariant(STRUCTURE_FEET[0]), productId: '' }
          }
          if (value === HEAD_PARLIN_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: makeHeadParlinVariant(HEAD_PARLIN_FEET[0]), productId: '' }
          }
          if (value === C_CHANNEL_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: makeCChannelVariant(C_CHANNEL_FEET[0]), productId: '' }
          }
          if (value === BASE_PLATE_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: BASE_PLATE_SIZES[0], productId: '' }
          }
          if (value === FASTNER_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: FASTNER_SIZES[0], productId: '' }
          }
          if (value === SS_NUT_BOLT_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: SS_NUT_BOLT_SIZES[0], productId: '' }
          }
          if (value === EARTHING_KIT_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: EARTHING_KIT_SIZES[0], productId: '' }
          }
          if (value === PIPE_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: PIPE_SIZES[0], productId: '' }
          }
          if (value === ALBA_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: ALBA_SIZES[0], productId: '' }
          }
          if (value === TE_GROUP) {
            return { ...item, moduleGroup: value, moduleType: '', technology: '', brand: '', capacity: TE_SIZES[0], productId: '' }
          }
          return { ...item, moduleGroup: DCR_GROUP, moduleType: 'P-Type', technology: '', brand: MODULE_BRANDS[0], capacity: MODULE_TYPES['DCR P-Type'][0], productId: '' }
        }
        if (['brand', 'capacity', 'technology'].includes(key)) {
          return { ...item, [key]: value, productId: '' }
        }
        return { ...item, [key]: value }
      }),
    }))
  }

  const submitDispatch = async (e) => {
    e.preventDefault()
    try {
      await dispatchAPI.create({
        ...dispatchForm,
        mobile: normalizePhone(dispatchForm.mobile),
        items: dispatchForm.items.filter(item => item.productId).map(item => ({ ...item, quantity: Number(item.quantity || 0) })),
      })
      toast.success('Dispatch saved, stock reduced')
      setDispatchForm(emptyDispatch)
      setDispatchFormOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed')
    }
  }

  const exportCsv = () => {
    const rows = [
      ['Item Name', 'Category', 'Brand', 'Type', 'Capacity', 'Quantity', 'Unit', 'Status'],
      ...products.map(item => [item.name, item.category, item.brand, item.type, item.capacity, item.quantity, item.unit, item.status]),
    ]
    const csv = rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'solar-inventory.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !products.length) return <Spinner size={48} />

  return (
    <div className="dashboard-page">
      <PageHeader
        icon={<FaWarehouse />}
        title={user?.role === 'Dispatch Manager' ? 'Dispatch Management' : 'Solar Inventory ERP'}
        subtitle="Inventory, dispatch, remaining stock, customer-wise material tracking"
        action={(
          <div className="dashboard-inline-actions">
            {canManageStock && <button className="btn btn-primary" onClick={openCreateProduct}><FaPlus /> Add Stock</button>}
            {canDispatch && <button className="btn btn-secondary" onClick={() => setDispatchFormOpen(true)}><FaShippingFast /> Dispatch</button>}
          </div>
        )}
      />

      <div className="crm-tabs">
        {[
          ['dashboard', 'Dashboard'],
          ['stock', 'Stock'],
          ['dispatch', 'Dispatch'],
          ['reports', 'Reports'],
        ].map(([key, label]) => (
          <button key={key} className={`crm-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="dashboard-grid-metrics">
            <MetricCard icon={<FaBoxOpen />} label="Total Items" value={summary.totalItems} change="Inventory SKUs" changeColor="var(--sun)" />
            <MetricCard icon={<FaWarehouse />} label="Total Quantity" value={summary.totalQuantity} change="Available stock" changeColor="var(--blue)" />
            <MetricCard icon={<FaExclamationTriangle />} label="Low Stock" value={summary.lowStockCount} change="< 10 threshold" changeColor="var(--red)" />
            <MetricCard icon={<FaShippingFast />} label="Material Dispatched" value={summary.totalDispatched} change="All dispatches" changeColor="var(--green)" />
          </div>

          {canDispatch && (
            <div className="crm-card" style={{ marginBottom:16 }}>
              <div className="dashboard-split-row" style={{ marginBottom:16 }}>
                <h3 style={{ fontSize:15, fontWeight:700 }}>Leads at Dispatch ({activeDispatchLeads.length})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setDispatchFormOpen(true)}><FaShippingFast /> New Dispatch</button>
              </div>
              {activeDispatchLeads.length === 0 ? (
                <EmptyState title="No leads pending at Dispatch" />
              ) : (
                <div className="crm-table-wrap">
                  <table className="crm-table">
                    <thead><tr><th>Customer</th><th>Phone / IVRS</th><th>City</th><th>Capacity</th><th>Action</th></tr></thead>
                    <tbody>
                      {activeDispatchLeads.map(lead => (
                        <tr key={lead._id}>
                          <td><strong>{lead.name}</strong><div style={{ fontSize:11, color:'var(--muted)' }}>{lead._id.slice(-6)}</div></td>
                          <td>{lead.phone}<div style={{ fontSize:11, color:'var(--muted)' }}>{lead.ivrsNo || '-'}</div></td>
                          <td>{lead.city || '-'}</td>
                          <td>{lead.capacity || '-'}</td>
                          <td>
                            <div className="dashboard-inline-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(lead)}>View / Approve</button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setDispatchForm(prev => ({
                                    ...prev,
                                    customerName: lead.name || '',
                                    leadId: lead.ivrsNo || lead._id,
                                    mobile: normalizePhone(lead.phone),
                                    siteAddress: lead.address || '',
                                  }))
                                  setDispatchFormOpen(true)
                                }}
                              >
                                Dispatch
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="dashboard-grid-two">
            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Stock vs Dispatch</h3>
              <div style={{ height:280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left:-20, bottom:50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill:'var(--muted)', fontSize:9 }} angle={-28} textAnchor="end" />
                    <YAxis tick={{ fill:'var(--muted)', fontSize:10 }} />
                    <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8 }} />
                    <Legend />
                    <Bar dataKey="stock" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="dispatched" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="crm-card">
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Low Stock Alerts</h3>
              {(stats?.lowStockItems || []).length === 0 ? (
                <EmptyState icon={<FaExclamationTriangle />} title="No low stock alerts" subtitle="All materials are above threshold." />
              ) : (
                <div className="dashboard-stack">
                  {(stats?.lowStockItems || []).map(item => (
                    <div key={item._id} className="crm-card-sm" style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{item.name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{item.category} | {item.brand || item.type}</div>
                      </div>
                      <span className="badge badge-red">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'stock' && (
        <div className="crm-card">
          <div className="dashboard-table-filters" style={{ marginBottom:16 }}>
            <div className="dashboard-search"><FaSearch /><input value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Search stock..." /></div>
            <select className="crm-input" value={filters.category} onChange={e => setFilters(prev => ({ ...prev, category: e.target.value }))}>
              <option value="">All categories</option>
              {Object.keys(CATEGORIES).map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={exportCsv}><FaDownload /> Excel CSV</button>
          </div>

          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Item Name</th><th>Category</th><th>Brand</th><th>Type</th><th>Capacity</th><th>Quantity</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {products.map(product => (
                  <tr key={product._id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.brand || '-'}</td>
                    <td>{product.type || '-'}</td>
                    <td>{product.capacity || '-'}</td>
                    <td>{product.quantity} {product.unit}</td>
                    <td><span className={`badge ${statusClass(product)}`}>{product.status}</span></td>
                    <td>
                      <div className="dashboard-inline-actions">
                        {canManageStock && <button className="btn btn-ghost btn-sm" onClick={() => openEditProduct(product)}>Update</button>}
                        {canManageStock && <button className="btn btn-ghost btn-sm" onClick={() => deleteProduct(product)}><FaTrash /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'dispatch' && (
        <div className="crm-card">
          <div className="dashboard-split-row" style={{ marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:700 }}>Dispatch Tracking</h3>
            {canDispatch && <button className="btn btn-primary btn-sm" onClick={() => setDispatchFormOpen(true)}><FaShippingFast /> New Dispatch</button>}
          </div>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Customer / Lead</th><th>Engineer</th><th>Items List</th><th>Quantity</th><th>Date</th></tr></thead>
              <tbody>
                {dispatches.map(dispatch => (
                  <tr key={dispatch._id}>
                    <td><strong>{dispatch.customerName}</strong><div style={{ fontSize:11, color:'var(--muted)' }}>{dispatch.leadId || dispatch.mobile}</div></td>
                    <td>{dispatch.engineerName}</td>
                    <td>{dispatch.items.map(item => item.productName).join(', ')}</td>
                    <td>{dispatch.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</td>
                    <td>{formatDate(dispatch.dispatchDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="dashboard-grid-two">
          <div className="crm-card">
            <div className="dashboard-split-row" style={{ marginBottom:14 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Lead-based View</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><FaFilePdf /> PDF</button>
            </div>
            <div className="dashboard-search" style={{ marginBottom:16 }}><FaSearch /><input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search lead/customer/mobile..." /></div>
            {!leadSearch ? <EmptyState icon={<FaSearch />} title="Search a lead" subtitle="Enter lead ID, customer name or mobile to view material history." /> : leadDispatches.length === 0 ? <EmptyState title="No dispatch found" /> : (
              <div className="dashboard-stack">
                {leadDispatches.map(dispatch => (
                  <div key={dispatch._id} className="crm-card-sm">
                    <div className="dashboard-split-row" style={{ marginBottom:8 }}>
                      <strong>{dispatch.customerName}</strong>
                      <span className="badge badge-blue">{formatDate(dispatch.dispatchDate)}</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>{dispatch.engineerName} | {dispatch.siteAddress}</div>
                    {dispatch.items.map(item => (
                      <div key={`${dispatch._id}-${item.productId}`} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'6px 0', borderTop:'1px solid var(--border)' }}>
                        <span>{item.productName}</span>
                        <strong>{item.quantity} {item.unit}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="crm-card">
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Activity Logs</h3>
            <div className="dashboard-stack">
              {(stats?.activity || []).map(item => (
                <div key={item._id} className="history-item">
                  <div style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,.1)' }}><FaChartBar /></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{item.action}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{item.message}</div>
                  </div>
                  <span style={{ fontSize:11, color:'var(--dim)' }}>{formatDate(item.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {productFormOpen && (
        <div className="modal-backdrop" style={{ alignItems:'stretch', padding:0 }} onClick={e => e.target === e.currentTarget && setProductFormOpen(false)}>
          <form className="modal-box" style={{ maxWidth:'100%', width:'100%', minHeight:'100vh', borderRadius:0, overflowY:'auto' }} onSubmit={saveProduct}>
            <PageHeader icon={<FaBoxOpen />} title={editingProduct ? 'Update Inventory Item' : 'Add Inventory Item'} action={<button type="button" className="btn btn-ghost" onClick={() => setProductFormOpen(false)}>Close</button>} />
            <div className="dashboard-form-grid">
              {isStructuredCategory(productForm.category) ? (
                <>
                  <div>
                    <label className="form-label">Type</label>
                    <select className="crm-input" value={MODULE_CATEGORY} onChange={e => setProductField('category', e.target.value)}>
                      {STOCK_CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{getCategoryLabel(category)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Module Category</label>
                    <select className="crm-input" value={getProductGroup(productForm)} onChange={e => setProductField('moduleGroup', e.target.value)}>
                      <option value={DCR_GROUP}>DCR</option>
                      <option value={INVERTER_GROUP}>Inverter On Grid</option>
                      <option value={AC_DC_GROUP}>AC+DC Box</option>
                      <option value={CABLE_TRY_GROUP}>Cable Try</option>
                      <option value={STRUCTURE_GROUP}>Structure</option>
                      <option value={HEAD_PARLIN_GROUP}>Head Parlin</option>
                      <option value={C_CHANNEL_GROUP}>C Channel</option>
                      <option value={BASE_PLATE_GROUP}>Base Plate</option>
                      <option value={FASTNER_GROUP}>Fastner</option>
                      <option value={SS_NUT_BOLT_GROUP}>SS Nut Bolt</option>
                      <option value={EARTHING_KIT_GROUP}>Earthing Kit</option>
                      <option value={PIPE_GROUP}>Pipe</option>
                      <option value={ALBA_GROUP}>Alba</option>
                      <option value={TE_GROUP}>Te</option>
                    </select>
                  </div>
                  {getProductGroup(productForm) === DCR_GROUP && (
                    <div>
                      <label className="form-label">Module Type</label>
                      <select className="crm-input" value={getProductModuleKind(productForm.type)} onChange={e => setProductField('moduleKind', e.target.value)}>
                        <option value="P-Type">P-Type</option>
                        <option value="N-Type">N-Type</option>
                      </select>
                    </div>
                  )}
                  {getProductGroup(productForm) === DCR_GROUP && getProductModuleKind(productForm.type) === 'N-Type' && (
                    <div>
                      <label className="form-label">Technology</label>
                      <select className="crm-input" value="TOPCon" onChange={() => {}}>
                        <option value="TOPCon">TOPCon</option>
                      </select>
                    </div>
                  )}
                  {[STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP].includes(getProductGroup(productForm)) && (
                    <div>
                      <label className="form-label">Size</label>
                      <select className="crm-input" value={getProductGroup(productForm) === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : getProductGroup(productForm) === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE} onChange={() => {}}>
                        <option value={getProductGroup(productForm) === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : getProductGroup(productForm) === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE}>{getProductGroup(productForm) === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : getProductGroup(productForm) === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE}</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label">{[AC_DC_GROUP, CABLE_TRY_GROUP].includes(getProductGroup(productForm)) ? 'Category' : [STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP].includes(getProductGroup(productForm)) ? 'Feet' : [BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP].includes(getProductGroup(productForm)) ? 'Size' : 'Capacity'}</label>
                    <select className="crm-input" value={productForm.capacity} onChange={e => setProductField('capacity', e.target.value)}>
                      {getProductCapacityOptions(productForm).map(item => <option key={item} value={item}>{getProductGroup(productForm) === STRUCTURE_GROUP ? getStructureFeet(item) : getProductGroup(productForm) === HEAD_PARLIN_GROUP ? getHeadParlinFeet(item) : getProductGroup(productForm) === C_CHANNEL_GROUP ? getCChannelFeet(item) : item}</option>)}
                    </select>
                  </div>
                  {getProductBrandOptions(productForm).length > 0 && (
                    <div>
                      <label className="form-label">Brand</label>
                      <select className="crm-input" value={productForm.brand} onChange={e => setProductField('brand', e.target.value)}>
                        {getProductBrandOptions(productForm).map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div><label className="form-label">Category</label><select className="crm-input" value={productForm.category} onChange={e => setProductField('category', e.target.value)}>{STOCK_CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{getCategoryLabel(category)}</option>)}</select></div>
                  <div><label className="form-label">Brand</label><input className="crm-input" value={productForm.brand} onChange={e => setProductField('brand', e.target.value)} list="brand-options" /><datalist id="brand-options">{(CATEGORIES[productForm.category]?.brands || []).map(item => <option key={item} value={item} />)}</datalist></div>
                  <div><label className="form-label">Type / Subcategory</label><select className="crm-input" value={productForm.type} onChange={e => setProductField('type', e.target.value)}>{Object.keys(CATEGORIES[productForm.category]?.types || {}).map(type => <option key={type}>{type}</option>)}</select></div>
                  <div><label className="form-label">Capacity / Variant</label><input className="crm-input" value={productForm.capacity} onChange={e => setProductField('capacity', e.target.value)} list="capacity-options" /><datalist id="capacity-options">{(CATEGORIES[productForm.category]?.types?.[productForm.type] || []).map(item => <option key={item} value={item} />)}</datalist></div>
                </>
              )}
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">Item Name</label><input className="crm-input" value={productForm.name} onChange={e => setProductField('name', e.target.value)} placeholder="Auto name bhi chalega, ya custom item name likhein" /></div>
              <div><label className="form-label">Quantity</label><input className="crm-input" type="number" min="0" value={productForm.quantity} onChange={e => setProductField('quantity', e.target.value)} required /></div>
              <div><label className="form-label">Unit</label><input className="crm-input" value={productForm.unit} onChange={e => setProductField('unit', e.target.value)} /></div>
              <div><label className="form-label">Low Stock Alert Below</label><input className="crm-input" type="number" min="0" value={productForm.lowStockThreshold} onChange={e => setProductField('lowStockThreshold', e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:20 }} type="submit">{editingProduct ? 'Save Stock Update' : 'Add Item'}</button>
          </form>
        </div>
      )}

      {dispatchFormOpen && (
        <div className="modal-backdrop" style={{ alignItems:'stretch', padding:0 }} onClick={e => e.target === e.currentTarget && setDispatchFormOpen(false)}>
          <form className="modal-box" style={{ maxWidth:'100%', width:'100%', minHeight:'100vh', borderRadius:0, overflowY:'auto' }} onSubmit={submitDispatch}>
            <PageHeader icon={<FaShippingFast />} title="Dispatch Materials" subtitle="Stock submit hote hi automatic reduce hoga" action={<button type="button" className="btn btn-ghost" onClick={() => setDispatchFormOpen(false)}>Close</button>} />
            <div className="dashboard-form-grid">
              <div><label className="form-label">Customer Name</label><input className="crm-input" value={dispatchForm.customerName} onChange={e => setDispatchForm(prev => ({ ...prev, customerName: e.target.value }))} required /></div>
              <div><label className="form-label">Lead ID</label><input className="crm-input" value={dispatchForm.leadId} onChange={e => setDispatchForm(prev => ({ ...prev, leadId: e.target.value }))} /></div>
              <div><label className="form-label">Installation Engineer</label><input className="crm-input" value={dispatchForm.engineerName} onChange={e => setDispatchForm(prev => ({ ...prev, engineerName: e.target.value }))} required /></div>
              <div><label className="form-label">Mobile Number</label><input className="crm-input" value={dispatchForm.mobile} onChange={e => setDispatchForm(prev => ({ ...prev, mobile: normalizePhone(e.target.value) }))} maxLength={10} required /></div>
              <div><label className="form-label">Dispatch Date</label><input className="crm-input" type="date" value={dispatchForm.dispatchDate} onChange={e => setDispatchForm(prev => ({ ...prev, dispatchDate: e.target.value }))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">Site Address</label><textarea className="crm-input" rows={3} value={dispatchForm.siteAddress} onChange={e => setDispatchForm(prev => ({ ...prev, siteAddress: e.target.value }))} required /></div>
            </div>

            <div className="crm-card-sm" style={{ marginTop:18 }}>
              <div className="dashboard-split-row" style={{ marginBottom:12 }}>
                <strong>Material Selection</strong>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDispatchForm(prev => ({ ...prev, items: [...prev.items, makeDispatchItem()] }))}><FaPlus /> Add Row</button>
              </div>
              <div className="dashboard-stack">
                {dispatchForm.items.map((item, index) => {
                  const selected = products.find(product => product._id === item.productId)
                  const capacityOptions = getDispatchCapacityOptions(item)
                  const brandOptions = getDispatchBrandOptions(item)
                  const matchingProducts = products.filter(product => matchesDispatchModule(product, item))
                  return (
                    <div key={index} className="dashboard-form-grid" style={{ gap:10 }}>
                      <div>
                        <label className="form-label">Type</label>
                        <select className="crm-input" value={item.category || MODULE_CATEGORY} onChange={e => updateDispatchItem(index, 'category', e.target.value)} required>
                          <option value={MODULE_CATEGORY}>Module</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Module Category</label>
                        <select className="crm-input" value={item.moduleGroup || 'DCR'} onChange={e => updateDispatchItem(index, 'moduleGroup', e.target.value)} required>
                          <option value={DCR_GROUP}>DCR</option>
                          <option value={INVERTER_GROUP}>Inverter On Grid</option>
                          <option value={AC_DC_GROUP}>AC+DC Box</option>
                          <option value={CABLE_TRY_GROUP}>Cable Try</option>
                          <option value={STRUCTURE_GROUP}>Structure</option>
                          <option value={HEAD_PARLIN_GROUP}>Head Parlin</option>
                          <option value={C_CHANNEL_GROUP}>C Channel</option>
                          <option value={BASE_PLATE_GROUP}>Base Plate</option>
                          <option value={FASTNER_GROUP}>Fastner</option>
                          <option value={SS_NUT_BOLT_GROUP}>SS Nut Bolt</option>
                          <option value={EARTHING_KIT_GROUP}>Earthing Kit</option>
                          <option value={PIPE_GROUP}>Pipe</option>
                          <option value={ALBA_GROUP}>Alba</option>
                          <option value={TE_GROUP}>Te</option>
                        </select>
                      </div>
                      {![INVERTER_GROUP, AC_DC_GROUP, CABLE_TRY_GROUP, STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP, BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP].includes(item.moduleGroup) && (
                        <div>
                          <label className="form-label">Module Type</label>
                          <select className="crm-input" value={item.moduleType || 'P-Type'} onChange={e => updateDispatchItem(index, 'moduleType', e.target.value)} required>
                            <option value="P-Type">P-Type</option>
                            <option value="N-Type">N-Type</option>
                          </select>
                        </div>
                      )}
                      {![INVERTER_GROUP, AC_DC_GROUP, CABLE_TRY_GROUP, STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP, BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP].includes(item.moduleGroup) && item.moduleType === 'N-Type' && (
                        <div>
                          <label className="form-label">Technology</label>
                          <select className="crm-input" value={item.technology || 'TOPCon'} onChange={e => updateDispatchItem(index, 'technology', e.target.value)} required>
                            <option value="TOPCon">TOPCon</option>
                          </select>
                        </div>
                      )}
                      {[STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP].includes(item.moduleGroup) && (
                        <div>
                          <label className="form-label">Size</label>
                          <select className="crm-input" value={item.moduleGroup === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : item.moduleGroup === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE} onChange={() => {}}>
                            <option value={item.moduleGroup === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : item.moduleGroup === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE}>{item.moduleGroup === HEAD_PARLIN_GROUP ? HEAD_PARLIN_SIZE : item.moduleGroup === C_CHANNEL_GROUP ? C_CHANNEL_SIZE : STRUCTURE_SIZE}</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="form-label">{[AC_DC_GROUP, CABLE_TRY_GROUP].includes(item.moduleGroup) ? 'Category' : [STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP].includes(item.moduleGroup) ? 'Feet' : [BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP].includes(item.moduleGroup) ? 'Size' : 'Capacity'}</label>
                        <select className="crm-input" value={item.capacity || ''} onChange={e => updateDispatchItem(index, 'capacity', e.target.value)} required>
                          {capacityOptions.map(capacity => <option key={capacity} value={capacity}>{item.moduleGroup === STRUCTURE_GROUP ? getStructureFeet(capacity) : item.moduleGroup === HEAD_PARLIN_GROUP ? getHeadParlinFeet(capacity) : item.moduleGroup === C_CHANNEL_GROUP ? getCChannelFeet(capacity) : capacity}</option>)}
                        </select>
                      </div>
                      {brandOptions.length > 0 && (
                        <div>
                          <label className="form-label">Brand</label>
                          <select className="crm-input" value={item.brand || brandOptions[0]} onChange={e => updateDispatchItem(index, 'brand', e.target.value)} required>
                            {brandOptions.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="form-label">Material</label>
                        <select className="crm-input" value={item.productId} onChange={e => updateDispatchItem(index, 'productId', e.target.value)} required>
                          <option value="">{matchingProducts.length ? 'Select material...' : 'No matching stock found'}</option>
                          {matchingProducts.map(product => <option key={product._id} value={product._id}>{product.name} | {product.quantity} {product.unit} left</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Quantity {selected ? `(${selected.unit})` : ''}</label>
                        <input className="crm-input" type="number" min="1" max={selected?.quantity || undefined} value={item.quantity} onChange={e => updateDispatchItem(index, 'quantity', e.target.value)} required />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:20 }} type="submit">Submit Dispatch</button>
          </form>
        </div>
      )}

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={loadData}
          currentUser={user}
        />
      )}
    </div>
  )
}
