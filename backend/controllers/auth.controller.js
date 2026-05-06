const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');
const { uploadFileAsset, withFreshFileUrl } = require('../services/storage/fileAsset');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
const signDocumentUploadToken = (id) => jwt.sign(
  { id, purpose: 'registration-document-upload' },
  process.env.JWT_SECRET,
  { expiresIn: '30m' }
);

const buildSessionUser = async (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  alternateContact: user.alternateContact,
  permanentAddress: user.permanentAddress,
  address: user.address,
  state: user.state,
  city: user.city,
  pincode: user.pincode,
  franchiseEnabled: user.franchiseEnabled,
  franchiseName: user.franchiseName,
  franchiseState: user.franchiseState,
  franchiseCity: user.franchiseCity,
  franchiseSubDistrict: user.franchiseSubDistrict,
  jobTitle: user.jobTitle,
  resume: user.resume,
  documents: user.documents,
  documentsFile: await withFreshFileUrl(user.documentsFile),
  documentsUploadStatus: user.documentsUploadStatus,
  documentsUploadError: user.documentsUploadError,
  dateOfJoining: user.dateOfJoining,
  stageAccess: ROLE_STAGE_MAP[user.role],
  lastLogin: user.lastLogin,
});

const updateRegistrationDocument = async (userId, file) => {
  const uploadedDocument = await uploadFileAsset(file, { folder: 'users/registrations' });
  await User.findByIdAndUpdate(userId, {
    documents: uploadedDocument.fileUrl,
    documentsFile: uploadedDocument,
    documentsUploadStatus: 'completed',
    documentsUploadError: '',
  });
  return uploadedDocument;
};

const queueRegistrationDocumentUpload = (userId, file) => {
  if (!file) return;

  setImmediate(async () => {
    try {
      await updateRegistrationDocument(userId, file);
    } catch (error) {
      await User.findByIdAndUpdate(userId, {
        documentsUploadStatus: 'failed',
        documentsUploadError: String(error.message || 'Document upload failed').slice(0, 500),
      }).catch(() => {});
      console.error('Registration document upload failed:', error);
    }
  });
};

const SERVICE_MANAGER_DEMO = {
  name: 'Vikram Service',
  email: 'service@solarcrm.in',
  password: 'service123',
  role: 'Service Manager',
  phone: '9800000011',
  jobTitle: 'Service Manager'
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    let user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user && normalizedEmail === SERVICE_MANAGER_DEMO.email && password === SERVICE_MANAGER_DEMO.password) {
      const created = await User.create(SERVICE_MANAGER_DEMO);
      user = await User.findById(created._id).select('+password');
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or account deactivated.' });
    }

    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ success: false, message: 'Your registration is pending admin approval.' });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'Your registration request was rejected by admin.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or account deactivated.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    const userData = await buildSessionUser(user);

    res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      alternateContact,
      permanentAddress,
      address,
      state,
      city,
      pincode,
      franchiseEnabled,
      franchiseName,
      franchiseState,
      franchiseCity,
      franchiseSubDistrict,
      jobTitle,
      resume,
      documents,
      dateOfJoining
    } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      phone,
      alternateContact,
      permanentAddress,
      address,
      state,
      city,
      pincode,
      franchiseEnabled,
      franchiseName,
      franchiseState,
      franchiseCity,
      franchiseSubDistrict,
      jobTitle,
      resume,
      documents: req.file?.originalname || documents,
      documentsUploadStatus: req.file ? 'processing' : 'none',
      dateOfJoining: dateOfJoining || undefined,
      isActive: false,
      approvalStatus: 'pending',
    });
    const safe = await User.findById(user._id).select('-password');

    await User.updateMany(
      { role: 'Admin', isActive: true },
      { $push: { notifications: { message: `New registration pending approval: ${user.name} (${user.role})` } } }
    );

    queueRegistrationDocumentUpload(user._id, req.file);

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Please wait for admin approval before logging in.',
      data: {
        ...safe.toObject(),
        documentsFile: await withFreshFileUrl(safe.documentsFile),
      },
      documentUploadToken: signDocumentUploadToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadRegistrationDocumentFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Document file is required.' });
    }

    const decoded = jwt.verify(req.body.uploadToken, process.env.JWT_SECRET);
    if (
      decoded.purpose !== 'registration-document-upload'
      || String(decoded.id) !== String(req.params.id)
    ) {
      return res.status(403).json({ success: false, message: 'Invalid document upload token.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Registration not found.' });
    if (user.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Document upload is only available while registration is pending.' });
    }

    await User.findByIdAndUpdate(user._id, {
      documents: req.file.originalname,
      documentsUploadStatus: 'processing',
      documentsUploadError: '',
    });

    const uploadedDocument = await updateRegistrationDocument(user._id, req.file);

    res.json({
      success: true,
      message: 'Registration document uploaded.',
      data: {
        documents: uploadedDocument.fileUrl,
        documentsFile: await withFreshFileUrl(uploadedDocument),
        documentsUploadStatus: 'completed',
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(403).json({ success: false, message: 'Invalid or expired document upload token.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      user: {
        ...(await buildSessionUser(user)),
        stageAccess: ROLE_STAGE_MAP[user.role],
        password: undefined
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Logout (client-side token removal; server just confirms)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};
