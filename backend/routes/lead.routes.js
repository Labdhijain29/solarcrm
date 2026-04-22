const express = require('express');
const router = express.Router();
const {
  getLeads, getLead, createLead, updateLead,
  approveLead, rejectLead, addNote, deleteLead
} = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateLead } = require('../middleware/validate.middleware');

router.use(protect);

router.route('/')
  .get(getLeads)
  .post(authorize('Admin', 'Manager', 'Sales Manager'), validateLead, createLead);

router.route('/:id')
  .get(getLead)
  .put(updateLead)
  .delete(authorize('Admin'), deleteLead);

router.post('/:id/approve', approveLead);
router.post('/:id/reject', rejectLead);
router.post('/:id/note', addNote);

module.exports = router;
