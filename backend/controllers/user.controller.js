// ─── USER CONTROLLER ──────────────────────────────────────────
const { runGlobal } = require('../services/officeContext');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');

const WORKFLOW_STAGES = [
  'Lead', 'Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement',
  'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Subsidy Reading', 'Completed',
];
const { withFreshFileUrl } = require('../services/storage/fileAsset');
const { createUserAccount } = require('../services/userAccount');
const storageService = require('../services/storage/storageService');
const { uploadFileAsset } = require('../services/storage/fileAsset');
const { isValidFollowUpDate } = require('../services/enquiryFollowUp');

const serializeUser = async (user) => {
  const plainUser = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  return {
    ...plainUser,
    documentsFile: await withFreshFileUrl(plainUser.documentsFile),
  };
};

const getRoleQuery = (role) => {
  if (role !== 'Bank/Finance Executive') return role;
  return {
    $in: [
      'Bank/Finance Executive',
      'Bank Finance Executive',
      'Bank-Finance Executive',
      'Bank Executive',
      'Finance Executive',
    ],
  };
};

const getStageRoles = (stage) => (
  Object.keys(ROLE_STAGE_MAP).filter((role) => ROLE_STAGE_MAP[role] === stage)
);

const buildSessionUser = async (user) => ({
  _id: user._id,
  office: user.office,
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
  dateOfJoining: user.dateOfJoining,
  stageAccess: user.stageAccess,
  lastLogin: user.lastLogin,
});

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: await Promise.all(users.map(serializeUser)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAssignableUsers = async (req, res) => {
  try {
    const role = String(req.query.role || '').trim();
    const stage = String(req.query.stage || '').trim();

    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }

    const roleStage = ROLE_STAGE_MAP[role];
    const userStage = ROLE_STAGE_MAP[req.user.role];
    const requestedStage = stage || roleStage;
    const requestedStageIndex = WORKFLOW_STAGES.indexOf(requestedStage);
    const userStageIndex = WORKFLOW_STAGES.indexOf(userStage);
    const nextStage = userStageIndex >= 0 ? WORKFLOW_STAGES[userStageIndex + 1] : '';
    const nextStageRoles = getStageRoles(nextStage);
    const isPreviousStageLookup = requestedStageIndex !== -1
      && userStageIndex !== -1
      && requestedStageIndex === userStageIndex - 1
      && roleStage === stage;
    const isNextStageLookup = requestedStageIndex !== -1
      && userStageIndex !== -1
      && requestedStageIndex === userStageIndex + 1
      && nextStageRoles.includes(role);
    const canViewRole = req.user.role === 'Admin'
      || req.user.role === role
      || (stage && userStage === stage && roleStage === stage)
      || isPreviousStageLookup
      || isNextStageLookup
      || (userStage === 'Lead' && stage === 'Registration' && roleStage === stage);

    if (!canViewRole) {
      return res.status(403).json({ success: false, message: 'You cannot view users for this role.' });
    }

    if (stage && roleStage !== stage) {
      return res.status(400).json({ success: false, message: `Role '${role}' is not registered for '${stage}' stage.` });
    }

    const users = await User.find({
      role: getRoleQuery(role),
      isActive: { $ne: false },
      approvalStatus: { $ne: 'rejected' },
    }).select('name email role phone isActive approvalStatus').sort({ name: 1 });

    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: await serializeUser(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createUser = async (req, res) => {
  try {
    const user = await createUserAccount({ body: req.body, file: req.file, approvedBy: req.user._id });
    const safe = await User.findById(user._id).select('-password');
    res.status(201).json({ success: true, message: 'User created', data: await serializeUser(safe) });
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.name === 'ValidationError' ? 422 : err.statusCode || 500;
    res.status(status).json({ success: false, message: err.code === 11000 ? 'Email already in use' : err.message });
  }
};

exports.updateUser = async (req, res) => {
  let asset;
  try {
    if (req.body.office !== undefined) return res.status(400).json({ success: false, message: 'Moving users between offices is not allowed.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const fields = ['name', 'email', 'phone', 'role', 'alternateContact', 'permanentAddress', 'address', 'state', 'city', 'pincode', 'jobTitle', 'resume', 'documents', 'franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict'];
    const updates = {};
    const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
    for (const field of fields) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== 'string') invalid(`Enter a valid ${field}.`);
      updates[field] = req.body[field].trim();
    }
    if (updates.name !== undefined && !updates.name) invalid('Name is required.');
    if (updates.email !== undefined) {
      updates.email = updates.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) invalid('Enter a valid email address.');
      if (await runGlobal(() => User.exists({ email: updates.email, _id: { $ne: user._id } }))) invalid('Email already in use.');
    }
    for (const field of ['phone', 'alternateContact']) {
      if (updates[field] === undefined) continue;
      updates[field] = updates[field].replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
      if (updates[field] && !/^[6-9]\d{9}$/.test(updates[field])) invalid(field === 'phone' ? 'Contact must be a valid 10-digit mobile number.' : 'Alternate contact must be a valid 10-digit mobile number.');
    }
    if (updates.pincode && !/^\d{6}$/.test(updates.pincode)) invalid('Pincode must contain 6 digits.');
    if (updates.role && !User.schema.path('role').enumValues.includes(updates.role)) invalid('Select a valid role.');
    if (String(req.user._id) === String(user._id) && updates.role && updates.role !== user.role) invalid('You cannot change your own role from User Management.');
    for (const field of ['isActive', 'franchiseEnabled']) {
      if (req.body[field] === undefined) continue;
      if (![true, false, 'true', 'false'].includes(req.body[field])) invalid(`Enter a valid ${field}.`);
      updates[field] = req.body[field] === true || req.body[field] === 'true';
    }
    if (req.body.approvalStatus !== undefined) updates.approvalStatus = req.body.approvalStatus;
    if (req.body.dateOfJoining !== undefined) {
      const date = req.body.dateOfJoining;
      if (date && (typeof date !== 'string' || !isValidFollowUpDate(date.slice(0, 10)) || Number.isNaN(new Date(date).getTime()))) invalid('Enter a valid date of joining.');
      updates.dateOfJoining = date || null;
    }
    const franchiseFields = ['franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict'];
    if ((updates.franchiseEnabled !== undefined || franchiseFields.some(field => updates[field] !== undefined)) && !(updates.franchiseEnabled ?? user.franchiseEnabled)) {
      franchiseFields.forEach(field => { updates[field] = ''; });
    }
    const query = { _id: user._id };
    if (req.body.expectedUpdatedAt) {
      if (String(req.body.expectedUpdatedAt) !== user.updatedAt?.toISOString()) return res.status(409).json({ success: false, message: 'This user changed. Close Edit and reopen it to load the latest details.' });
      query.updatedAt = new Date(req.body.expectedUpdatedAt);
    }
    if (req.file) {
      asset = await uploadFileAsset(req.file, { folder: 'users/registrations' });
      updates.documents = asset.fileUrl;
      updates.documentsFile = asset;
      updates.documentsUploadStatus = 'completed';
      updates.documentsUploadError = '';
    }
    const updated = await User.findOneAndUpdate(query, updates, { new: true, runValidators: true }).select('-password');
    if (!updated) throw Object.assign(new Error('This user changed. Close Edit and reopen it to load the latest details.'), { statusCode: 409 });
    res.json({ success: true, message: 'User updated successfully.', data: await serializeUser(updated) });
  } catch (err) {
    if (asset?.fileKey) {
      try { if (!await User.exists({ 'documentsFile.fileKey': asset.fileKey })) await storageService.delete(asset.fileKey); } catch { /* Preserve assets when saved references cannot be checked. */ }
    }
    const status = err.code === 11000 ? 400 : err.statusCode || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
    res.status(status).json({ success: false, message: err.code === 11000 ? 'Email already in use.' : err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      alternateContact,
      permanentAddress,
      address,
      state,
      city,
      pincode,
      jobTitle,
    } = req.body;

    const updates = {
      name,
      phone,
      alternateContact,
      permanentAddress,
      address,
      state,
      city,
      pincode,
      jobTitle,
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: await buildSessionUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (user?.documentsFile?.fileKey) {
      storageService.delete(user.documentsFile.fileKey).catch(() => {});
    }
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
    res.json({ success: true, message: 'User approved successfully', data: await serializeUser(user) });
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
    res.json({ success: true, message: 'User rejected successfully', data: await serializeUser(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const notifs = user.notifications.filter(n => String(n.office) === String(req.office._id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    res.json({ success: true, data: notifs, unread: notifs.filter(n => !n.read).length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { 'notifications.$[item].read': true } }, { arrayFilters: [{ 'item.office': req.office._id }] });
    res.json({ success: true, message: 'All notifications marked read' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
