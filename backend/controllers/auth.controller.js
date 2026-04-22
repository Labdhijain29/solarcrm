const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

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

    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user && email.toLowerCase() === SERVICE_MANAGER_DEMO.email && password === SERVICE_MANAGER_DEMO.password) {
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
    const userData = {
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
      jobTitle: user.jobTitle,
      resume: user.resume,
      documents: user.documents,
      dateOfJoining: user.dateOfJoining,
      stageAccess: ROLE_STAGE_MAP[user.role],
      lastLogin: user.lastLogin,
    };

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
      jobTitle,
      resume,
      documents,
      dateOfJoining
    } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      phone,
      alternateContact,
      permanentAddress,
      address,
      state,
      city,
      pincode,
      jobTitle,
      resume,
      documents,
      dateOfJoining: dateOfJoining || undefined,
      isActive: false,
      approvalStatus: 'pending',
    });
    const safe = await User.findById(user._id).select('-password');

    await User.updateMany(
      { role: 'Admin', isActive: true },
      { $push: { notifications: { message: `New registration pending approval: ${user.name} (${user.role})` } } }
    );

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Please wait for admin approval before logging in.',
      data: safe
    });
  } catch (err) {
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
        ...user.toObject(),
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
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
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
