const express = require('express');
const router = express.Router();
const { createDispatch, getDispatches, getDispatchesByLead } = require('../controllers/dispatch.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/')
  .get(authorize('Admin', 'Stock Manager', 'Dispatch Manager'), getDispatches)
  .post(authorize('Admin', 'Dispatch Manager'), createDispatch);

router.get('/:leadId', authorize('Admin', 'Stock Manager', 'Dispatch Manager'), getDispatchesByLead);

module.exports = router;
