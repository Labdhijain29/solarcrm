const express = require('express');
const router = express.Router();
const { getUploadSettings, updateUploadSettings } = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('Admin'));

router.route('/upload')
  .get(getUploadSettings)
  .put(updateUploadSettings);

module.exports = router;
