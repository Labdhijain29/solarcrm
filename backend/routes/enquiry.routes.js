// ─── enquiry.routes.js ───────────────────────────────────────
const express = require('express');
const router = express.Router();
const { getEnquiries, getDueFollowUps, addFollowUp, createEnquiry, convertToLead, updateEnquiry, deleteEnquiry } = require('../controllers/enquiry.controller');
const { protect, optionalProtect, authorize } = require('../middleware/auth.middleware');
const { validateEnquiry } = require('../middleware/validate.middleware');

// Public: website enquiry form
router.post('/', optionalProtect, validateEnquiry, createEnquiry);

// Protected
router.use(protect);
router.get('/', authorize('Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Service Manager', 'Enquiry Executive'), getEnquiries);
router.get('/follow-ups/due', authorize('Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Service Manager', 'Enquiry Executive'), getDueFollowUps);
router.post('/:id/follow-ups', authorize('Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Service Manager', 'Enquiry Executive'), addFollowUp);
router.post('/:id/convert', authorize('Admin', 'Manager', 'Sales Executive', 'Sales Manager', 'Enquiry Executive'), convertToLead);
router.put('/:id', authorize('Admin', 'Manager', 'Enquiry Executive'), updateEnquiry);
router.post('/:id/delete', authorize('Admin', 'Manager', 'Enquiry Executive'), deleteEnquiry);
router.delete('/:id', authorize('Admin', 'Manager', 'Enquiry Executive'), deleteEnquiry);

module.exports = router;
