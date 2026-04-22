import { City, State } from 'country-state-city'

export const STAGES = [
  'Lead', 'Registration', 'Bank Approval', 'Loan Disbursement',
  'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Completed',
]

export const STAGE_COLORS = [
  '#94A3B8', '#6366F1', '#3B82F6', '#F59E0B',
  '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#10B981',
]

export const ROLE_STAGE_MAP = {
  'Admin': null,
  'Manager': 'Lead',
  'Sales Manager': 'Lead',
  'Registration Executive': 'Registration',
  'Bank/Finance Executive': 'Bank Approval',
  'Loan Officer': 'Loan Disbursement',
  'Dispatch Manager': 'Dispatch',
  'Installation Manager': 'Installation',
  'Net Metering Officer': 'Net Metering',
  'Subsidy Officer': 'Subsidy',
  'Service Manager': null,
}

export const ROLE_ICONS = {
  'Admin': 'AD',
  'Manager': 'MN',
  'Sales Manager': 'SL',
  'Registration Executive': 'RG',
  'Bank/Finance Executive': 'BK',
  'Loan Officer': 'LN',
  'Dispatch Manager': 'DP',
  'Installation Manager': 'IN',
  'Net Metering Officer': 'NM',
  'Subsidy Officer': 'SB',
  'Service Manager': 'SV',
}

export const SOURCES = ['Website', 'Social Media', 'Referral', 'Cold Call', 'Exhibition', 'Google Ads', 'Other']
export const KW_OPTIONS = ['1kW', '2kW', '3kW', '5kW', '7kW', '10kW', '15kW', '20kW+']
const INDIA_COUNTRY_CODE = 'IN'
const INDIA_STATES = State.getStatesOfCountry(INDIA_COUNTRY_CODE) || []

export const STATE_OPTIONS = INDIA_STATES.map((item) => item.name).sort((a, b) => a.localeCompare(b))

const getStateIsoCode = (stateName) => {
  const match = INDIA_STATES.find((item) => item.name === stateName)
  return match?.isoCode || ''
}

export const getCitiesForState = (stateName) => {
  const isoCode = getStateIsoCode(stateName)
  if (!isoCode) return []

  return Array.from(
    new Set(
      (City.getCitiesOfState(INDIA_COUNTRY_CODE, isoCode) || []).map((item) => item.name)
    )
  ).sort((a, b) => a.localeCompare(b))
}

export const CITIES = Array.from(
  new Set(
    INDIA_STATES.flatMap((item) => getCitiesForState(item.name))
  )
).sort((a, b) => a.localeCompare(b))

export const getSubDistrictOptions = (cityName) => {
  if (!cityName) return []

  const base = cityName.trim()
  return [
    `${base} Central`,
    `${base} North`,
    `${base} South`,
    `${base} East`,
    `${base} West`,
    `${base} Rural`,
  ]
}

export const stageColor = (stage) => STAGE_COLORS[STAGES.indexOf(stage)] || '#94A3B8'
export const stageIndex = (stage) => STAGES.indexOf(stage)

export const STATUS_BADGE = {
  active: 'badge-sun',
  completed: 'badge-green',
  rejected: 'badge-red',
  'on-hold': 'badge-indigo',
}

export const canActOnStage = (userRole, leadStage) => {
  if (userRole === 'Admin') return true
  return ROLE_STAGE_MAP[userRole] === leadStage
}

export const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatPhone = (p) => p ? p.replace(/(\d{5})(\d{5})/, '$1 $2') : '-'
