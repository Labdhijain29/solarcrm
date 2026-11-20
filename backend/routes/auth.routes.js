// ─── auth.routes.js ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { globalHandler, publicOffice } = require('../middleware/office.middleware');
const { login, register, uploadRegistrationDocumentFile, getMe, changePassword, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateLogin, validateRegister } = require('../middleware/validate.middleware');
const { uploadRegistrationDocument } = require('../middleware/upload.middleware');

router.post('/login', validateLogin, globalHandler(login));
router.post('/register', uploadRegistrationDocument, validateRegister, publicOffice, register);
router.post('/register/:id/document', uploadRegistrationDocument, globalHandler(uploadRegistrationDocumentFile));
router.get('/me', protect, globalHandler(getMe));
router.put('/change-password', protect, globalHandler(changePassword));
router.post('/logout', protect, logout);

module.exports = router;
