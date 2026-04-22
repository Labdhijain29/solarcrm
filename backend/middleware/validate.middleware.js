const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const validateLogin = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation
];

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn([
    'Manager', 'Sales Manager', 'Registration Executive',
    'Bank/Finance Executive', 'Loan Officer', 'Dispatch Manager',
    'Installation Manager', 'Net Metering Officer', 'Subsidy Officer',
    'Service Manager'
  ]).withMessage('Valid role required'),
  body('phone').trim().notEmpty().withMessage('Contact required'),
  body('alternateContact').optional({ checkFalsy: true }).trim(),
  body('permanentAddress').optional({ checkFalsy: true }).trim(),
  body('address').optional({ checkFalsy: true }).trim(),
  body('state').optional({ checkFalsy: true }).trim(),
  body('city').optional({ checkFalsy: true }).trim(),
  body('pincode').optional({ checkFalsy: true }).trim(),
  body('jobTitle').optional({ checkFalsy: true }).trim(),
  body('resume').optional({ checkFalsy: true }).trim(),
  body('documents').optional({ checkFalsy: true }).trim(),
  body('dateOfJoining').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date of joining required'),
  handleValidation
];

const validateLead = [
  body('name').trim().notEmpty().withMessage('Customer name required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number required')
    .bail()
    .customSanitizer((value) => {
      const digits = String(value || '').replace(/\D/g, '');
      return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    })
    .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number required'),
  body('source').optional().isIn(['Website','Social Media','Referral','Cold Call','Exhibition','Google Ads','Other']),
  handleValidation
];

const validateEnquiry = [
  body('name').notEmpty().trim().withMessage('Name required'),
  body('contact')
    .notEmpty().withMessage('Contact required')
    .bail()
    .trim()
    .customSanitizer((value) => String(value || '').replace(/\D/g, ''))
    .matches(/^(91)?[6-9]\d{9}$/).withMessage('Valid contact number required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email required'),
  body('address').optional({ checkFalsy: true }).trim(),
  body('enquiryType').notEmpty().trim().withMessage('Enquiry type required'),
  body('state').optional({ checkFalsy: true }).trim(),
  body('city').optional({ checkFalsy: true }).trim(),
  body('pincode')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\d{6}$/).withMessage('Valid 6-digit pincode required'),
  handleValidation
];

module.exports = { validateLogin, validateRegister, validateLead, validateEnquiry, handleValidation };
