// ─── auth.routes.js ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { login, register, getMe, changePassword, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateLogin, validateRegister } = require('../middleware/validate.middleware');
const { uploadRegistrationDocument } = require('../middleware/upload.middleware');

router.post('/login', validateLogin, login);
router.post('/register', uploadRegistrationDocument, validateRegister, register);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);

module.exports = router;
