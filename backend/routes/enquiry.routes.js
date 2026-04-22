// ─── enquiry.routes.js ───────────────────────────────────────
const express = require('express');
const router = express.Router();
const { getEnquiries, createEnquiry, convertToLead, updateEnquiry } = require('../controllers/enquiry.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateEnquiry } = require('../middleware/validate.middleware');

// Public: website enquiry form
router.post('/', validateEnquiry, createEnquiry);

// Protected
router.use(protect);
router.get('/', authorize('Admin', 'Manager', 'Sales Manager', 'Service Manager'), getEnquiries);
router.post('/:id/convert', authorize('Admin', 'Manager', 'Sales Manager'), convertToLead);
router.put('/:id', authorize('Admin', 'Manager'), updateEnquiry);

module.exports = router;
