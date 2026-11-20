// ─── user.routes.js ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { globalHandler } = require('../middleware/office.middleware');
const {
  getUsers, getUser, createUser, updateUser, deleteUser,
  getNotifications, markNotificationsRead, approveUser, rejectUser, updateProfile, getAssignableUsers
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadRegistrationDocument } = require('../middleware/upload.middleware');
const { validateCreateUser } = require('../middleware/validate.middleware');

router.use(protect);

router.put('/me', globalHandler(updateProfile));
router.get('/notifications', globalHandler(getNotifications));
router.put('/notifications/read', globalHandler(markNotificationsRead));
router.get('/assignable', getAssignableUsers);

router.route('/')
  .get(authorize('Admin', 'Manager'), getUsers)
  .post(authorize('Admin'), uploadRegistrationDocument, validateCreateUser, createUser);

router.route('/:id')
  .get(getUser)
  .put(authorize('Admin'), uploadRegistrationDocument, updateUser)
  .delete(authorize('Admin'), deleteUser);

router.post('/:id/approve', authorize('Admin'), approveUser);
router.post('/:id/reject', authorize('Admin'), rejectUser);

module.exports = router;
