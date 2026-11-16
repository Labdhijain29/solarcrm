const { body, validationResult } = require('express-validator');
const { normalizeContactPhone } = require('../services/contactPhone');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(e => ({ field: e.path, message: e.msg }));
    return res.status(422).json({
      success: false,
      message: [...new Set(details.map(error => error.message))].join('\n'),
      errors: details
    });
  }
  next();
};

const validateLogin = [
  body('email').trim().isEmail().withMessage('Valid email required').bail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation
];

const accountValidation = (allowAdmin = false) => [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').trim().isEmail().withMessage('Valid email required').bail().normalizeEmail(),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(require('../models/User').schema.path('role').enumValues.filter(role => allowAdmin || role !== 'Admin')).withMessage('Valid role required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Contact required')
    .bail()
    .customSanitizer((value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, ''))
    .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit contact number required'),
  body('alternateContact')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, ''))
    .matches(/^[6-9]\d{9}$/).withMessage('Alternate contact must be a valid 10-digit number'),
  body('permanentAddress').optional({ checkFalsy: true }).trim(),
  body('address').optional({ checkFalsy: true }).trim(),
  body('state').optional({ checkFalsy: true }).trim(),
  body('city').optional({ checkFalsy: true }).trim(),
  body('pincode').optional({ checkFalsy: true }).trim().matches(/^\d{6}$/).withMessage('Valid 6-digit pincode required'),
  body('franchiseEnabled').optional().isBoolean().withMessage('Franchise flag must be true or false'),
  body('franchiseName').optional({ checkFalsy: true }).trim(),
  body('franchiseState').optional({ checkFalsy: true }).trim(),
  body('franchiseCity').optional({ checkFalsy: true }).trim(),
  body('franchiseSubDistrict').optional({ checkFalsy: true }).trim(),
  body('jobTitle').optional({ checkFalsy: true }).trim(),
  body('resume').optional({ checkFalsy: true }).trim(),
  body('documents').optional({ checkFalsy: true }).trim(),
  body('dateOfJoining').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date of joining required'),
  handleValidation
];

const validateRegister = accountValidation();
const validateCreateUser = accountValidation(true);

const validateLead = [
  body('name').trim().notEmpty().withMessage('Customer name is required.'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Contact number is required.')
    .bail()
    .customSanitizer(normalizeContactPhone)
    .matches(/^\d{10}$/).withMessage('Contact number must contain exactly 10 digits.'),
  body('ivrsNo')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Za-z0-9]{1,15}$/).withMessage('Valid IVRS number up to 15 letters or digits required'),
  body('branch').trim().notEmpty().withMessage('Branch is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email address.'),
  body('pincode').optional({ checkFalsy: true }).trim().matches(/^\d{6}$/).withMessage('Pincode must contain exactly 6 digits.'),
  body('source').optional().isIn(['Website','Social Media','Referral','Cold Call','Exhibition','Google Ads','Other']).withMessage('Please select a valid lead source.'),
  body('generatedThrough').optional().trim(),
  body('salesExecutiveAssignee').optional({ checkFalsy: true }).isMongoId().withMessage('Valid sales executive assignee required'),
  handleValidation
];

const validateEnquiry = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('contact')
    .trim()
    .notEmpty().withMessage('Contact number is required.')
    .bail()
    .customSanitizer(normalizeContactPhone)
    .matches(/^\d{10}$/).withMessage('Contact number must contain exactly 10 digits.'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email address.'),
  body('address').optional({ checkFalsy: true }).trim(),
  body('enquiryType').trim().notEmpty().withMessage('Please select an enquiry type.'),
  body('state').optional({ checkFalsy: true }).trim(),
  body('city').optional({ checkFalsy: true }).trim(),
  body('pincode')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\d{6}$/).withMessage('Pincode must contain exactly 6 digits.'),
  handleValidation
];

const optionalContact = field => body(field).optional().customSanitizer(normalizeContactPhone)
  .matches(/^\d{10}$/).withMessage('Contact number must contain exactly 10 digits.');
const updateFields = () => [
  body('name').optional().trim().notEmpty().withMessage('Customer name is required.'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email address.'),
  body('pincode').optional({ checkFalsy: true }).trim().matches(/^\d{6}$/).withMessage('Pincode must contain exactly 6 digits.'),
];
const validateLeadUpdate = [optionalContact('phone'), ...updateFields(), handleValidation];
const validateEnquiryUpdate = [optionalContact('contact'), optionalContact('phone'), ...updateFields(),
  body('enquiryType').optional().trim().notEmpty().withMessage('Please select an enquiry type.'), handleValidation];

module.exports = { validateLogin, validateRegister, validateCreateUser, validateLead, validateEnquiry, validateLeadUpdate, validateEnquiryUpdate, handleValidation };
