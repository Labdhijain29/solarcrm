// ─── USER CONTROLLER ──────────────────────────────────────────
const User = require('../models/User');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createUser = async (req, res) => {
  try {
    const {
      name, email, password, role, phone, alternateContact,
      permanentAddress, address, state, city, pincode, jobTitle,
      resume, documents, dateOfJoining
    } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({
      name, email, password, role, phone, alternateContact,
      permanentAddress, address, state, city, pincode, jobTitle,
      resume, documents, dateOfJoining: dateOfJoining || undefined
    });
    const safe = await User.findById(user._id).select('-password');
    res.status(201).json({ success: true, message: 'User created', data: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateUser = async (req, res) => {
  try {
    const {
      name, phone, isActive, role, approvalStatus, alternateContact, permanentAddress,
      address, state, city, pincode, jobTitle, resume, documents, dateOfJoining
    } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, {
      name, phone, isActive, role, approvalStatus, alternateContact, permanentAddress,
      address, state, city, pincode, jobTitle, resume, documents,
      dateOfJoining: dateOfJoining || undefined
    }, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isActive: true,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      approvedBy: req.user._id,
    }, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User approved successfully', data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isActive: false,
      approvalStatus: 'rejected',
      approvedAt: null,
      approvedBy: req.user._id,
    }, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User rejected successfully', data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const notifs = user.notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    res.json({ success: true, data: notifs, unread: notifs.filter(n => !n.read).length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { 'notifications.$[].read': true } });
    res.json({ success: true, message: 'All notifications marked read' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
