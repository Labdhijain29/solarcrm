export const MODULE_CATEGORY = 'MODULE'
export const LEGACY_MODULE_CATEGORY = 'SOLAR PANELS'
export const INVERTER_CATEGORY = 'INVERTER (ON-GRID)'
export const AC_DC_CATEGORY = 'AC/DC BOX'
export const CABLE_TRY_CATEGORY = 'CABLE TRY'
export const STRUCTURE_CATEGORY = 'STRUCTURE'
export const HEAD_PARLIN_CATEGORY = 'HEAD PARLIN'
export const C_CHANNEL_CATEGORY = 'C CHANNEL'
export const BASE_PLATE_CATEGORY = 'BASE PLATE'
export const FASTNER_CATEGORY = 'FASTNER'
export const SS_NUT_BOLT_CATEGORY = 'SS NUT BOLT'
export const EARTHING_KIT_CATEGORY = 'EARTHING KIT'
export const PIPE_CATEGORY = 'PIPE'
export const ALBA_CATEGORY = 'ALBA'
export const TE_CATEGORY = 'TE'
export const AC_WIRE_CATEGORY = 'AC Wire'
export const DC_CABLE_CATEGORY = 'DC Cable'
export const MC4_CONNECTOR_CATEGORY = 'MC4 Connector'
export const EARTHING_WIRE_16MM_CATEGORY = 'Earthing Wire 16mm'
export const C_CLIP_CATEGORY = 'C Clip'

export const DCR_GROUP = 'DCR'
export const INVERTER_GROUP = 'INVERTER_ON_GRID'
export const AC_DC_GROUP = 'AC_DC_BOX'
export const CABLE_TRY_GROUP = 'CABLE_TRY'
export const STRUCTURE_GROUP = 'STRUCTURE'
export const HEAD_PARLIN_GROUP = 'HEAD_PARLIN'
export const C_CHANNEL_GROUP = 'C_CHANNEL'
export const BASE_PLATE_GROUP = 'BASE_PLATE'
export const FASTNER_GROUP = 'FASTNER'
export const SS_NUT_BOLT_GROUP = 'SS_NUT_BOLT'
export const EARTHING_KIT_GROUP = 'EARTHING_KIT'
export const PIPE_GROUP = 'PIPE'
export const ALBA_GROUP = 'ALBA'
export const TE_GROUP = 'TE'
export const AC_WIRE_GROUP = 'AC_WIRE'
export const DC_CABLE_GROUP = 'DC_CABLE'
export const MC4_CONNECTOR_GROUP = 'MC4_CONNECTOR'
export const EARTHING_WIRE_16MM_GROUP = 'EARTHING_WIRE_16MM'
export const C_CLIP_GROUP = 'C_CLIP'

export const MODULE_BRANDS = ['Warree', 'Adani', 'Tata', 'Luminous', 'Havells']
export const MODULE_TYPES = {
  'DCR P-Type': ['530WP', '535WP', '540WP', '545WP', '550WP'],
  'N-Type TOPCon': ['560WP', '565WP', '570WP', '575WP', '580WP', '585WP'],
}
export const INVERTER_BRANDS = ['Warree', 'Luminious', 'Polycab', 'Sungrow', 'Sunbase']
export const INVERTER_CAPACITIES = ['3kw', '4kw', '5kw', '6kw', '7kw', '8kw', '9kw', '10kw', '15kw']
export const AC_DC_BRANDS = ['Havells', 'Simons']
export const AC_DC_PHASES = ['Single Phase', 'Three Phase']
export const CABLE_TRY_ITEMS = ['Cable Try']
export const STRUCTURE_BRANDS = ['JSW']
export const ALL_BRAND_OPTIONS = [...new Set([...MODULE_BRANDS, ...INVERTER_BRANDS, ...AC_DC_BRANDS, ...STRUCTURE_BRANDS])]
export const STRUCTURE_SIZE = '140*50*2mm'
export const STRUCTURE_FEET = ['6.5feet', '8.5feet', '13 feet', '10 feet', '21 feet']
export const HEAD_PARLIN_SIZE = '70*50*1.5mm'
export const HEAD_PARLIN_FEET = ['21 feet', '13 feet']
export const C_CHANNEL_SIZE = '41*41mm'
export const C_CHANNEL_FEET = ['10.5feet', '21 feet']
export const BASE_PLATE_SIZES = ['140*50', '80*40']
export const FASTNER_SIZES = ['10*100']
export const SS_NUT_BOLT_SIZES = ['8*25 SS', '10*25 SS', '10*25 gi']
export const EARTHING_KIT_SIZES = ['17*1 Mtr', 'LA 17*1 mtr']
export const PIPE_SIZES = ['10*25']
export const ALBA_SIZES = ['10*25']
export const TE_SIZES = ['10*25']
export const AC_WIRE_SIZES = ['40 Mtr', '200 Mtr']
export const DC_CABLE_SIZES = ['30 Mtr']
export const EARTHING_WIRE_16MM_SIZES = ['100 Mtr']
export const C_CLIP_SIZES = ['25 mm']

export const makeStructureVariant = (feet) => `${STRUCTURE_SIZE} | ${feet}`
export const makeHeadParlinVariant = (feet) => `${HEAD_PARLIN_SIZE} | ${feet}`
export const makeCChannelVariant = (feet) => `${C_CHANNEL_SIZE} | ${feet}`
export const getStructureFeet = (variant) => String(variant || '').split('|').pop().trim()
export const getHeadParlinFeet = (variant) => String(variant || '').split('|').pop().trim()
export const getCChannelFeet = (variant) => String(variant || '').split('|').pop().trim()

export const STOCK_CATEGORY_OPTIONS = Object.keys({
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
  [AC_WIRE_CATEGORY]: true,
  [DC_CABLE_CATEGORY]: true,
  [MC4_CONNECTOR_CATEGORY]: true,
  [EARTHING_WIRE_16MM_CATEGORY]: true,
  [C_CLIP_CATEGORY]: true,
  CABLE: true,
  'STRUCTURE MATERIAL': true,
  'EARTHING & SAFETY': true,
})

export const CATEGORIES = {
  [MODULE_CATEGORY]: { brands: MODULE_BRANDS, types: { ...MODULE_TYPES }, unit: 'pcs' },
  [LEGACY_MODULE_CATEGORY]: { brands: MODULE_BRANDS, types: { ...MODULE_TYPES }, unit: 'pcs' },
  [INVERTER_CATEGORY]: { brands: INVERTER_BRANDS, types: { Capacity: INVERTER_CAPACITIES }, unit: 'pcs' },
  [AC_DC_CATEGORY]: { brands: AC_DC_BRANDS, types: { Phase: AC_DC_PHASES }, unit: 'pcs' },
  [CABLE_TRY_CATEGORY]: { brands: [], types: { Item: CABLE_TRY_ITEMS }, unit: 'pcs' },
  [STRUCTURE_CATEGORY]: { brands: STRUCTURE_BRANDS, types: { Size: STRUCTURE_FEET.map(makeStructureVariant) }, unit: 'pcs' },
  [HEAD_PARLIN_CATEGORY]: { brands: [], types: { Size: HEAD_PARLIN_FEET.map(makeHeadParlinVariant) }, unit: 'pcs' },
  [C_CHANNEL_CATEGORY]: { brands: [], types: { Size: C_CHANNEL_FEET.map(makeCChannelVariant) }, unit: 'pcs' },
  [BASE_PLATE_CATEGORY]: { brands: [], types: { Size: BASE_PLATE_SIZES }, unit: 'pcs' },
  [FASTNER_CATEGORY]: { brands: [], types: { Size: FASTNER_SIZES }, unit: 'pcs' },
  [SS_NUT_BOLT_CATEGORY]: { brands: [], types: { Size: SS_NUT_BOLT_SIZES }, unit: 'pcs' },
  [EARTHING_KIT_CATEGORY]: { brands: [], types: { Size: EARTHING_KIT_SIZES }, unit: 'pcs' },
  [PIPE_CATEGORY]: { brands: [], types: { Size: PIPE_SIZES }, unit: 'pcs' },
  [ALBA_CATEGORY]: { brands: [], types: { Size: ALBA_SIZES }, unit: 'pcs' },
  [TE_CATEGORY]: { brands: [], types: { Size: TE_SIZES }, unit: 'pcs' },
  [AC_WIRE_CATEGORY]: { brands: [], types: { Size: AC_WIRE_SIZES }, unit: 'mtr' },
  [DC_CABLE_CATEGORY]: { brands: [], types: { Size: DC_CABLE_SIZES }, unit: 'mtr' },
  [MC4_CONNECTOR_CATEGORY]: { brands: [], types: {}, unit: 'pcs' },
  [EARTHING_WIRE_16MM_CATEGORY]: { brands: [], types: { Size: EARTHING_WIRE_16MM_SIZES }, unit: 'mtr' },
  [C_CLIP_CATEGORY]: { brands: [], types: { Size: C_CLIP_SIZES }, unit: 'pcs' },
  CABLE: { brands: [], types: { Type: ['DC Cable', 'AC Cable', 'Earthing Cable', 'Solar Cable'] }, unit: 'mtr' },
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

export const MODULE_GROUP_OPTIONS = [
  { value: DCR_GROUP, label: 'DCR' },
  { value: INVERTER_GROUP, label: 'Inverter On Grid' },
  { value: AC_DC_GROUP, label: 'AC+DC Box' },
  { value: CABLE_TRY_GROUP, label: 'Cable Try' },
  { value: STRUCTURE_GROUP, label: 'Structure' },
  { value: HEAD_PARLIN_GROUP, label: 'Head Parlin' },
  { value: C_CHANNEL_GROUP, label: 'C Channel' },
  { value: BASE_PLATE_GROUP, label: 'Base Plate' },
  { value: FASTNER_GROUP, label: 'Fastner' },
  { value: SS_NUT_BOLT_GROUP, label: 'SS Nut Bolt' },
  { value: EARTHING_KIT_GROUP, label: 'Earthing Kit' },
  { value: PIPE_GROUP, label: 'Pipe' },
  { value: ALBA_GROUP, label: 'Alba' },
  { value: TE_GROUP, label: 'Te' },
  { value: AC_WIRE_GROUP, label: 'AC Wire' },
  { value: DC_CABLE_GROUP, label: 'DC Cable' },
  { value: MC4_CONNECTOR_GROUP, label: 'MC4 Connector' },
  { value: EARTHING_WIRE_16MM_GROUP, label: 'Earthing Wire 16mm' },
  { value: C_CLIP_GROUP, label: 'C Clip' },
]

export const NON_MODULE_GROUPS = [
  INVERTER_GROUP,
  AC_DC_GROUP,
  CABLE_TRY_GROUP,
  STRUCTURE_GROUP,
  HEAD_PARLIN_GROUP,
  C_CHANNEL_GROUP,
  BASE_PLATE_GROUP,
  FASTNER_GROUP,
  SS_NUT_BOLT_GROUP,
  EARTHING_KIT_GROUP,
  PIPE_GROUP,
  ALBA_GROUP,
  TE_GROUP,
  AC_WIRE_GROUP,
  DC_CABLE_GROUP,
  MC4_CONNECTOR_GROUP,
  EARTHING_WIRE_16MM_GROUP,
  C_CLIP_GROUP,
]

export const isSizedLengthGroup = (group) => [STRUCTURE_GROUP, HEAD_PARLIN_GROUP, C_CHANNEL_GROUP].includes(group)
export const isStandaloneGroup = (group) => [MC4_CONNECTOR_GROUP].includes(group)
export const isSimpleSizeGroup = (group) => [BASE_PLATE_GROUP, FASTNER_GROUP, SS_NUT_BOLT_GROUP, EARTHING_KIT_GROUP, PIPE_GROUP, ALBA_GROUP, TE_GROUP, AC_WIRE_GROUP, DC_CABLE_GROUP, EARTHING_WIRE_16MM_GROUP, C_CLIP_GROUP].includes(group)
export const isStructuredCategory = (category) => [
  MODULE_CATEGORY,
  LEGACY_MODULE_CATEGORY,
  INVERTER_CATEGORY,
  AC_DC_CATEGORY,
  CABLE_TRY_CATEGORY,
  STRUCTURE_CATEGORY,
  HEAD_PARLIN_CATEGORY,
  C_CHANNEL_CATEGORY,
  BASE_PLATE_CATEGORY,
  FASTNER_CATEGORY,
  SS_NUT_BOLT_CATEGORY,
  EARTHING_KIT_CATEGORY,
  PIPE_CATEGORY,
  ALBA_CATEGORY,
  TE_CATEGORY,
  AC_WIRE_CATEGORY,
  DC_CABLE_CATEGORY,
  MC4_CONNECTOR_CATEGORY,
  EARTHING_WIRE_16MM_CATEGORY,
  C_CLIP_CATEGORY,
].includes(category)
export const getCategoryLabel = (category) => category === MODULE_CATEGORY ? 'Module' : category
export const getProductModuleKind = (type) => type === 'N-Type TOPCon' ? 'N-Type' : 'P-Type'

export const getProductGroup = (form) => {
  if (form.category === INVERTER_CATEGORY) return INVERTER_GROUP
  if (form.category === AC_DC_CATEGORY) return AC_DC_GROUP
  if (form.category === CABLE_TRY_CATEGORY) return CABLE_TRY_GROUP
  if (form.category === STRUCTURE_CATEGORY) return STRUCTURE_GROUP
  if (form.category === HEAD_PARLIN_CATEGORY) return HEAD_PARLIN_GROUP
  if (form.category === C_CHANNEL_CATEGORY) return C_CHANNEL_GROUP
  if (form.category === BASE_PLATE_CATEGORY) return BASE_PLATE_GROUP
  if (form.category === FASTNER_CATEGORY) return FASTNER_GROUP
  if (form.category === SS_NUT_BOLT_CATEGORY) return SS_NUT_BOLT_GROUP
  if (form.category === EARTHING_KIT_CATEGORY) return EARTHING_KIT_GROUP
  if (form.category === PIPE_CATEGORY) return PIPE_GROUP
  if (form.category === ALBA_CATEGORY) return ALBA_GROUP
  if (form.category === TE_CATEGORY) return TE_GROUP
  if (form.category === AC_WIRE_CATEGORY) return AC_WIRE_GROUP
  if (form.category === DC_CABLE_CATEGORY) return DC_CABLE_GROUP
  if (form.category === MC4_CONNECTOR_CATEGORY) return MC4_CONNECTOR_GROUP
  if (form.category === EARTHING_WIRE_16MM_CATEGORY) return EARTHING_WIRE_16MM_GROUP
  if (form.category === C_CLIP_CATEGORY) return C_CLIP_GROUP
  return DCR_GROUP
}

export const getCapacityOptionsByGroup = (group, moduleType = 'P-Type') => {
  if (group === INVERTER_GROUP) return INVERTER_CAPACITIES
  if (group === AC_DC_GROUP) return AC_DC_PHASES
  if (group === CABLE_TRY_GROUP) return CABLE_TRY_ITEMS
  if (group === STRUCTURE_GROUP) return STRUCTURE_FEET.map(makeStructureVariant)
  if (group === HEAD_PARLIN_GROUP) return HEAD_PARLIN_FEET.map(makeHeadParlinVariant)
  if (group === C_CHANNEL_GROUP) return C_CHANNEL_FEET.map(makeCChannelVariant)
  if (group === BASE_PLATE_GROUP) return BASE_PLATE_SIZES
  if (group === FASTNER_GROUP) return FASTNER_SIZES
  if (group === SS_NUT_BOLT_GROUP) return SS_NUT_BOLT_SIZES
  if (group === EARTHING_KIT_GROUP) return EARTHING_KIT_SIZES
  if (group === PIPE_GROUP) return PIPE_SIZES
  if (group === ALBA_GROUP) return ALBA_SIZES
  if (group === TE_GROUP) return TE_SIZES
  if (group === AC_WIRE_GROUP) return AC_WIRE_SIZES
  if (group === DC_CABLE_GROUP) return DC_CABLE_SIZES
  if (group === EARTHING_WIRE_16MM_GROUP) return EARTHING_WIRE_16MM_SIZES
  if (group === C_CLIP_GROUP) return C_CLIP_SIZES
  if (isStandaloneGroup(group)) return []
  return MODULE_TYPES[moduleType === 'N-Type' ? 'N-Type TOPCon' : 'DCR P-Type'] || []
}

export const getBrandOptionsByGroup = (group) => {
  if (group === INVERTER_GROUP) return INVERTER_BRANDS
  if (group === AC_DC_GROUP) return AC_DC_BRANDS
  if (group === STRUCTURE_GROUP) return STRUCTURE_BRANDS
  if (NON_MODULE_GROUPS.includes(group)) return []
  return MODULE_BRANDS
}

export const getProductCapacityOptions = (form) => getCapacityOptionsByGroup(getProductGroup(form), getProductModuleKind(form.type))
export const getProductBrandOptions = (form) => getBrandOptionsByGroup(getProductGroup(form))

export const emptyStructuredProduct = {
  name: '',
  category: MODULE_CATEGORY,
  subCategory: '',
  brand: MODULE_BRANDS[0],
  type: 'DCR P-Type',
  capacity: MODULE_TYPES['DCR P-Type'][0],
  quantity: '',
  price: '',
  unit: 'pcs',
  lowStockThreshold: 10,
}

export const makeDispatchItem = () => ({
  category: MODULE_CATEGORY,
  moduleGroup: DCR_GROUP,
  moduleType: 'P-Type',
  technology: '',
  capacity: MODULE_TYPES['DCR P-Type'][0],
  brand: MODULE_BRANDS[0],
})

export const getCapacityLabel = (group, capacity) => {
  if (group === STRUCTURE_GROUP) return getStructureFeet(capacity)
  if (group === HEAD_PARLIN_GROUP) return getHeadParlinFeet(capacity)
  if (group === C_CHANNEL_GROUP) return getCChannelFeet(capacity)
  return capacity
}

export const getFieldLabel = (group) => {
  if ([AC_DC_GROUP, CABLE_TRY_GROUP].includes(group)) return 'Category'
  if (isSizedLengthGroup(group)) return 'Feet'
  if (isSimpleSizeGroup(group)) return 'Size'
  return 'Capacity'
}

export const getFixedSizeLabel = (group) => {
  if (group === HEAD_PARLIN_GROUP) return HEAD_PARLIN_SIZE
  if (group === C_CHANNEL_GROUP) return C_CHANNEL_SIZE
  return STRUCTURE_SIZE
}

export const setStructuredProductField = (prev, key, value) => {
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
    const groupMap = {
      [INVERTER_GROUP]: { category: INVERTER_CATEGORY, brand: INVERTER_BRANDS[0], type: 'Capacity', capacity: INVERTER_CAPACITIES[0] },
      [AC_DC_GROUP]: { category: AC_DC_CATEGORY, brand: AC_DC_BRANDS[0], type: 'Phase', capacity: AC_DC_PHASES[0] },
      [CABLE_TRY_GROUP]: { category: CABLE_TRY_CATEGORY, brand: '', type: 'Item', capacity: CABLE_TRY_ITEMS[0] },
      [STRUCTURE_GROUP]: { category: STRUCTURE_CATEGORY, brand: STRUCTURE_BRANDS[0], type: 'Size', capacity: makeStructureVariant(STRUCTURE_FEET[0]) },
      [HEAD_PARLIN_GROUP]: { category: HEAD_PARLIN_CATEGORY, brand: '', type: 'Size', capacity: makeHeadParlinVariant(HEAD_PARLIN_FEET[0]) },
      [C_CHANNEL_GROUP]: { category: C_CHANNEL_CATEGORY, brand: '', type: 'Size', capacity: makeCChannelVariant(C_CHANNEL_FEET[0]) },
      [BASE_PLATE_GROUP]: { category: BASE_PLATE_CATEGORY, brand: '', type: 'Size', capacity: BASE_PLATE_SIZES[0] },
      [FASTNER_GROUP]: { category: FASTNER_CATEGORY, brand: '', type: 'Size', capacity: FASTNER_SIZES[0] },
      [SS_NUT_BOLT_GROUP]: { category: SS_NUT_BOLT_CATEGORY, brand: '', type: 'Size', capacity: SS_NUT_BOLT_SIZES[0] },
      [EARTHING_KIT_GROUP]: { category: EARTHING_KIT_CATEGORY, brand: '', type: 'Size', capacity: EARTHING_KIT_SIZES[0] },
      [PIPE_GROUP]: { category: PIPE_CATEGORY, brand: '', type: 'Size', capacity: PIPE_SIZES[0] },
      [ALBA_GROUP]: { category: ALBA_CATEGORY, brand: '', type: 'Size', capacity: ALBA_SIZES[0] },
      [TE_GROUP]: { category: TE_CATEGORY, brand: '', type: 'Size', capacity: TE_SIZES[0] },
      [AC_WIRE_GROUP]: { category: AC_WIRE_CATEGORY, brand: '', type: 'Size', capacity: AC_WIRE_SIZES[0], unit: 'mtr' },
      [DC_CABLE_GROUP]: { category: DC_CABLE_CATEGORY, brand: '', type: 'Size', capacity: DC_CABLE_SIZES[0], unit: 'mtr' },
      [MC4_CONNECTOR_GROUP]: { category: MC4_CONNECTOR_CATEGORY, brand: '', type: '', capacity: '', unit: 'pcs' },
      [EARTHING_WIRE_16MM_GROUP]: { category: EARTHING_WIRE_16MM_CATEGORY, brand: '', type: 'Size', capacity: EARTHING_WIRE_16MM_SIZES[0], unit: 'mtr' },
      [C_CLIP_GROUP]: { category: C_CLIP_CATEGORY, brand: '', type: 'Size', capacity: C_CLIP_SIZES[0], unit: 'pcs' },
    }
    const groupDefaults = groupMap[value] || emptyStructuredProduct
    return { ...prev, ...groupDefaults, unit: groupDefaults.unit || 'pcs' }
  }
  return { ...prev, [key]: value }
}

export const setDispatchStructureField = (prev, key, value) => {
  if (key === 'moduleType') {
    const next = { ...prev, moduleType: value, technology: value === 'N-Type' ? 'TOPCon' : '' }
    return { ...next, capacity: getCapacityOptionsByGroup(next.moduleGroup, next.moduleType)[0] || '' }
  }
  if (key === 'moduleGroup') {
    const brand = getBrandOptionsByGroup(value)[0] || ''
    const moduleType = NON_MODULE_GROUPS.includes(value) ? '' : 'P-Type'
    return {
      ...prev,
      moduleGroup: value,
      moduleType,
      technology: '',
      brand,
      capacity: getCapacityOptionsByGroup(value, moduleType)[0] || '',
    }
  }
  return { ...prev, [key]: value }
}

export const buildStructuredProductName = (source) => String(
  source.name || [source.brand, source.type, source.capacity].filter(Boolean).join(' ') || source.category || 'Stock Item'
).trim()

export const normalizeModuleValue = (value) => String(value || '').replace(/\s+/g, '').toLowerCase()
export const normalizeModuleBrand = (value) => normalizeModuleValue(value).replace('waaree', 'warree').replace('luminous', 'luminious')
export const normalizeModuleType = (value) => String(value || '') === 'N-Type' ? 'N-Type TOPCon' : String(value || '')

export const matchesDispatchModule = (product, item) => {
  const group = item.moduleGroup || DCR_GROUP
  const expectedType = group === DCR_GROUP ? (item.moduleType === 'N-Type' ? 'N-Type TOPCon' : 'DCR P-Type') : product.type
  const brandOptions = getBrandOptionsByGroup(group)

  if (getProductGroup(product) !== group) return false
  if (isStandaloneGroup(group)) return true
  if (expectedType && group === DCR_GROUP && normalizeModuleType(product.type) !== expectedType) return false
  if (normalizeModuleValue(product.capacity) !== normalizeModuleValue(item.capacity)) return false
  if (brandOptions.length && normalizeModuleBrand(product.brand) !== normalizeModuleBrand(item.brand)) return false
  return true
}
