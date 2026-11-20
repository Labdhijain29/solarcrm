export const SALES_MANAGER_STAGES = ['Lead', 'Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement']
export const SALES_MANAGER_DASHBOARD_PATHS = ['/dashboard/manager', '/dashboard/stage/name-change-executive', '/dashboard/stage/registration-executive', '/dashboard/stage/bank-finance-executive', '/dashboard/stage/loan-officer']
export const hasStageAdminAccess = (role, stage) => role === 'Admin'
  || (role === 'Sales Manager' && SALES_MANAGER_STAGES.includes(stage))
