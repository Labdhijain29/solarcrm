const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/auth.middleware');
const controller = require('../controllers/serviceRequest.controller');
const router = express.Router();

const photos = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 5 * 1024 * 1024, fields: 15, fieldSize: 20000 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase()) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    callback(allowed ? null : Object.assign(new Error('Only JPG, PNG and WEBP photos are allowed.'), { statusCode: 400 }), allowed);
  },
}).array('photos', 5);
const upload = (req, res, next) => photos(req, res, error => {
  if (!error) return next();
  const message = error.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 5 MB or smaller.' : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE' ? 'Upload up to 5 photos at a time in the photos field.' : error.message;
  res.status(400).json({ success: false, message });
});

router.use(protect, authorize('Admin', 'Service Manager'));
router.get('/managers', authorize('Admin'), controller.getManagers);
router.get('/', controller.list);
router.post('/', upload, controller.create);
router.get('/:id', controller.loadRequest, controller.getOne);
router.put('/:id', controller.loadRequest, controller.updateDetails);
router.post('/:id/activity', controller.loadRequest, upload, controller.addActivity);
router.put('/:id/status', controller.loadRequest, controller.setStatus);

module.exports = router;
