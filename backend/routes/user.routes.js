// ─── user.routes.js ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const {
  getUsers, getUser, createUser, updateUser, deleteUser,
  getNotifications, markNotificationsRead, approveUser, rejectUser
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/notifications', getNotifications);
router.put('/notifications/read', markNotificationsRead);

router.route('/')
  .get(authorize('Admin', 'Manager'), getUsers)
  .post(authorize('Admin'), createUser);

router.route('/:id')
  .get(getUser)
  .put(authorize('Admin'), updateUser)
  .delete(authorize('Admin'), deleteUser);

router.post('/:id/approve', authorize('Admin'), approveUser);
router.post('/:id/reject', authorize('Admin'), rejectUser);

module.exports = router;
