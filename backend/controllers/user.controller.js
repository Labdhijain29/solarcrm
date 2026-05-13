// ─── USER CONTROLLER ──────────────────────────────────────────
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');

const WORKFLOW_STAGES = [
  'Lead', 'Registration', 'Bank Approval', 'Loan Disbursement',
  'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Subsidy Reading', 'Completed',
];
const { uploadFileAsset, withFreshFileUrl } = require('../services/storage/fileAsset');
const storageService = require('../services/storage/storageService');

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

const updateUserDocument = async (userId, file) => {
  const uploadedDocument = await uploadFileAsset(file, { folder: 'users/registrations' });
  await User.findByIdAndUpdate(userId, {
    documents: uploadedDocument.fileUrl,
    documentsFile: uploadedDocument,
    documentsUploadStatus: 'completed',
    documentsUploadError: '',
  });
  return uploadedDocument;
};

const queueUserDocumentUpload = (userId, file) => {
  if (!file) return;

  setImmediate(async () => {
    try {
      await updateUserDocument(userId, file);
    } catch (error) {
      await User.findByIdAndUpdate(userId, {
        documentsUploadStatus: 'failed',
        documentsUploadError: String(error.message || 'Document upload failed').slice(0, 500),
      }).catch(() => {});
      console.error('User document upload failed:', error);
    }
  });
};

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
      || isNextStageLookup;

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
    const {
      name, email, password, role, phone, alternateContact,
      permanentAddress, address, state, city, pincode, jobTitle,
      resume, documents, dateOfJoining
    } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({
      name, email: normalizedEmail, password, role, phone, alternateContact,
      permanentAddress, address, state, city, pincode, jobTitle,
      resume,
      documents: req.file?.originalname || documents,
      documentsUploadStatus: req.file ? 'processing' : 'none',
      dateOfJoining: dateOfJoining || undefined
    });
    queueUserDocumentUpload(user._id, req.file);
    const safe = await User.findById(user._id).select('-password');
    res.status(201).json({ success: true, message: 'User created', data: await serializeUser(safe) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateUser = async (req, res) => {
  try {
    const {
      name, phone, isActive, role, approvalStatus, alternateContact, permanentAddress,
      address, state, city, pincode, jobTitle, resume, documents, dateOfJoining
    } = req.body;

    const updates = {
      name, phone, isActive, role, approvalStatus, alternateContact, permanentAddress,
      address, state, city, pincode, jobTitle, resume, documents,
      dateOfJoining: dateOfJoining || undefined
    };

    if (req.file) {
      const uploadedDocument = await uploadFileAsset(req.file, { folder: 'users/registrations' });
      updates.documents = uploadedDocument.fileUrl;
      updates.documentsFile = uploadedDocument;
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: await serializeUser(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
