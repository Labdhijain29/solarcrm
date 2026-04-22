const express = require('express');
const router = express.Router();
const { getStats, getActivity } = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/stats', getStats);
router.get('/activity', getActivity);

module.exports = router;
