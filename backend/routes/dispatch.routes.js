const express = require('express');
const router = express.Router();
const { approveDispatch, createDispatch, getDispatches, getDispatchesByLead, updateDispatch, updateInstallationStatus } = require('../controllers/dispatch.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/')
  .get(authorize('Admin', 'Stock Manager', 'Dispatch Manager', 'Installation Manager'), getDispatches)
  .post(authorize('Admin', 'Dispatch Manager'), createDispatch);

router.patch('/:id', authorize('Admin', 'Dispatch Manager'), updateDispatch);
router.post('/:id/approve', authorize('Admin', 'Dispatch Manager'), approveDispatch);
router.patch('/:id/installation-status', authorize('Admin', 'Installation Manager'), updateInstallationStatus);
router.get('/:leadId', authorize('Admin', 'Stock Manager', 'Dispatch Manager', 'Installation Manager'), getDispatchesByLead);

module.exports = router;
