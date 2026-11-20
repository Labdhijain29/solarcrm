const SALES_MANAGER_STAGES = ['Lead', 'Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement'];
const hasStageAdminAccess = (role, stage) => role === 'Admin'
  || (role === 'Sales Manager' && SALES_MANAGER_STAGES.includes(stage));
module.exports = { SALES_MANAGER_STAGES, hasStageAdminAccess };
