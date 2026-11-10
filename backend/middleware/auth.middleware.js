const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Token invalid or user deactivated.' });
    }

    req.user = user;
    if (user.role === 'Enquiry Executive' && !isEnquiryExecutiveRequestAllowed(req)) {
      return res.status(403).json({ success: false, message: 'This account has access to enquiries and its own profile only.' });
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const isEnquiryExecutiveRequestAllowed = (req) => {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const route = `${req.method} ${path}`;
  if (['GET /api/auth/me', 'PUT /api/auth/change-password', 'POST /api/auth/logout',
    'PUT /api/users/me', 'GET /api/users/notifications', 'PUT /api/users/notifications/read',
    'GET /api/enquiries', 'POST /api/enquiries', 'GET /api/enquiries/follow-ups/due'].includes(route)) return true;
  return /^(PUT|DELETE) \/api\/enquiries\/[a-f\d]{24}$/i.test(route)
    || /^POST \/api\/enquiries\/[a-f\d]{24}\/(convert|delete|follow-ups)$/i.test(route);
};

const optionalProtect = (req, res, next) => req.headers.authorization !== undefined
  ? protect(req, res, next) : next();

// Role-based access control
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Role '${req.user.role}' is not authorized.`
    });
  }
  next();
};

// Stage-based access: only the user assigned to a stage OR admin can act
const ROLE_STAGE_MAP = {
  'Admin': null,
  'Enquiry Executive': null,
  'Manager': 'Lead',
  'Sales Executive': 'Lead',
  'Sales Manager': 'Lead',
  'Registration Executive': 'Registration',
  'Bank/Finance Executive': 'Bank Approval',
  'Loan Officer': 'Loan Disbursement',
  'Stock Manager': null,
  'Dispatch Manager': 'Dispatch',
  'Installation Manager': 'Installation',
  'Net Metering Officer': 'Net Metering',
  'Subsidy Officer': 'Subsidy',
  'Subsidy Reading Officer': 'Subsidy Reading',
  'Service Manager': null,
};

const canActOnStage = (stage) => (req, res, next) => {
  const userStage = ROLE_STAGE_MAP[req.user.role];
  if (req.user.role === 'Admin' || userStage === stage) return next();
  return res.status(403).json({
    success: false,
    message: `Access denied. Your role '${req.user.role}' cannot act on '${stage}' stage.`
  });
};

module.exports = { protect, optionalProtect, authorize, canActOnStage, ROLE_STAGE_MAP, isEnquiryExecutiveRequestAllowed };
