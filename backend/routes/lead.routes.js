const express = require('express');
const router = express.Router();
const {
  getLeads, getLead, createLead, updateLead,
  approveLead, rejectLead, addNote, deleteLead
} = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateLead } = require('../middleware/validate.middleware');
const { uploadLeadFiles, normalizeMultipartBody } = require('../middleware/upload.middleware');

router.use(protect);

router.route('/')
  .get(getLeads)
  .post(authorize('Admin', 'Manager', 'Sales Executive', 'Sales Manager'), uploadLeadFiles, normalizeMultipartBody, validateLead, createLead);

router.route('/:id')
  .get(getLead)
  .put(uploadLeadFiles, normalizeMultipartBody, updateLead)
  .delete(authorize('Admin', 'Manager'), deleteLead);

router.post('/:id/approve', uploadLeadFiles, normalizeMultipartBody, approveLead);
router.post('/:id/reject', rejectLead);
router.post('/:id/note', addNote);

module.exports = router;
