const Lead = require('../models/Lead');
const Counter = require('../models/Counter');
const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');
const { uploadFileAsset } = require('../services/storage/fileAsset');

const leadFileFieldMap = {
  photoOne: {
    target: 'salesExecutiveData',
    nameField: 'photoOneName',
    fileField: 'photoOneFile',
    folder: 'sales-executive',
  },
  photoTwo: {
    target: 'salesExecutiveData',
    nameField: 'photoTwoName',
    fileField: 'photoTwoFile',
    folder: 'sales-executive',
  },
  documentPdf: {
    target: 'salesExecutiveData',
    nameField: 'documentPdfName',
    fileField: 'documentPdfFile',
    folder: 'sales-executive',
  },
  aadharCard: {
    target: 'salesExecutiveData',
    nameField: 'aadharCardName',
    fileField: 'aadharCardFile',
    folder: 'sales-executive',
  },
  panCard: {
    target: 'salesExecutiveData',
    nameField: 'panCardName',
    fileField: 'panCardFile',
    folder: 'sales-executive',
  },
  bankStatement: {
    target: 'salesExecutiveData',
    nameField: 'bankStatementName',
    fileField: 'bankStatementFile',
    folder: 'sales-executive',
  },
  panelPhoto: {
    target: 'installationData',
    nameField: 'panelPhotoName',
    fileField: 'panelPhotoFile',
    folder: 'installation',
  },
  inverterBoxPhoto: {
    target: 'installationData',
    nameField: 'inverterBoxPhotoName',
    fileField: 'inverterBoxPhotoFile',
    folder: 'installation',
  },
  earthingPhoto: {
    target: 'installationData',
    nameField: 'earthingPhotoName',
    fileField: 'earthingPhotoFile',
    folder: 'installation',
  },
  columnConcretePhoto: {
    target: 'installationData',
    nameField: 'columnConcretePhotoName',
    fileField: 'columnConcretePhotoFile',
    folder: 'installation',
  },
  customerShortVideo: {
    target: 'installationData',
    nameField: 'customerShortVideoName',
    fileField: 'customerShortVideoFile',
    folder: 'installation',
  },
  netMeteringPdf: {
    target: 'netMeteringData',
    nameField: 'pdfName',
    fileField: 'pdfFile',
    folder: 'net-metering',
  },
  subsidyPhoto: {
    target: 'subsidyData',
    nameField: 'photoName',
    fileField: 'photoFile',
    folder: 'subsidy',
  },
  subsidyPhotoTwo: {
    target: 'subsidyData',
    nameField: 'photoTwoName',
    fileField: 'photoTwoFile',
    folder: 'subsidy',
  },
  subsidyReadingPhoto: {
    target: 'subsidyReadingData',
    nameField: 'photoName',
    fileField: 'photoFile',
    folder: 'subsidy-reading',
  },
};

const stageDataMap = {
  'Registration': 'registrationData',
  'Bank Approval': 'bankData',
  'Loan Disbursement': 'loanData',
  'Dispatch': 'dispatchData',
  'Installation': 'installationData',
  'Net Metering': 'netMeteringData',
  'Subsidy': 'subsidyData',
  'Subsidy Reading': 'subsidyReadingData',
};

const getRequestFile = (req, fieldName) => {
  if (req.file?.fieldname === fieldName) return req.file;
  const value = req.files?.[fieldName];
  if (Array.isArray(value)) return value[0];
  return value || null;
};

const toPlainObject = (value) => (value?.toObject ? value.toObject() : value || {});

const mergePatch = (target, key, patch) => {
  if (!patch || Object.keys(patch).length === 0) return;
  target[key] = {
    ...toPlainObject(target[key]),
    ...patch,
  };
};

const collectUploadedLeadFilePatches = async (req, leadId) => {
  const patches = {};

  for (const [fieldName, config] of Object.entries(leadFileFieldMap)) {
    const file = getRequestFile(req, fieldName);
    if (!file) continue;

    const asset = await uploadFileAsset(file, {
      folder: `leads/${leadId}/${config.folder}`,
    });

    patches[config.target] = {
      ...(patches[config.target] || {}),
      [config.nameField]: asset.originalName,
      [config.fileField]: asset,
    };
  }

  return patches;
};

const mergeUploadedPatchesIntoBody = (body, patches) => {
  Object.entries(patches).forEach(([key, patch]) => {
    body[key] = {
      ...toPlainObject(body[key]),
      ...patch,
    };
  });
};

const isSingleStageRole = (role) => {
  const stageAccess = ROLE_STAGE_MAP[role];
  return Boolean(stageAccess) && !['Manager', 'Sales Executive', 'Sales Manager'].includes(role);
};

const isSalesExecutiveLead = (payload = {}) => {
  return Array.isArray(payload.tags) && payload.tags.includes('sales-executive');
};

const normalizeModulePanelNumbers = (value) => {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 6).map((item) => String(item || '').trim());
};

const ensureUniqueIvrsNo = async (ivrsNo, excludeId = null) => {
  const normalizedIvrsNo = String(ivrsNo || '').trim();
  if (!normalizedIvrsNo) return;

  const query = { ivrsNo: normalizedIvrsNo };
  if (excludeId) query._id = { $ne: excludeId };

  const existingLead = await Lead.findOne(query).select('_id name ivrsNo');
  if (existingLead) {
    const error = new Error(`IVRS number '${normalizedIvrsNo}' is already assigned to lead '${existingLead.name}'.`);
    error.statusCode = 409;
    throw error;
  }
};

const getSalesExecutiveManager = async () => {
  return User.findOne({ role: 'Manager', isActive: { $ne: false }, approvalStatus: { $ne: 'rejected' } }).sort({ createdAt: 1 });
};

const getNextLeadId = async () => {
  let counter = await Counter.findById('leadId');
  if (!counter) {
    const maxLead = await Lead.findOne({ leadId: { $exists: true, $ne: null } })
      .sort({ leadId: -1 })
      .select('leadId')
      .lean();

    try {
      counter = await Counter.create({
        _id: 'leadId',
        seq: Math.max(Number(maxLead?.leadId || 999), 999),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const updated = await Counter.findByIdAndUpdate(
    'leadId',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return Math.max(Number(updated.seq || 0), 1000);
};

const assignableUserFilter = (extra = {}) => ({
  ...extra,
  isActive: { $ne: false },
  approvalStatus: { $ne: 'rejected' },
});

const getRolesForStage = (stage) => (
  Object.keys(ROLE_STAGE_MAP).filter((role) => ROLE_STAGE_MAP[role] === stage)
);

const canUserActOnLead = (user, lead) => {
  if (user.role === 'Admin') return true;
  const userStage = ROLE_STAGE_MAP[user.role];
  return userStage === lead.currentStage && String(lead.assignedTo || '') === String(user._id);
};

const canUserViewLead = (user, lead) => {
  if (user.role === 'Admin') return true;
  const userId = String(user._id);
  if (String(lead.assignedTo?._id || lead.assignedTo || '') === userId) return true;
  if (String(lead.createdBy?._id || lead.createdBy || '') === userId) return true;
  return (lead.history || []).some((item) => String(item.performedBy || '') === userId);
};

const ensureUserCanActOnLead = (user, lead, action) => {
  if (canUserActOnLead(user, lead)) return;
  const userStage = ROLE_STAGE_MAP[user.role];
  const message = userStage !== lead.currentStage
    ? `You can only ${action} leads at '${userStage}' stage. This lead is at '${lead.currentStage}'.`
    : `You can only ${action} leads assigned to you.`;
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
};

const ensureUniqueApplicationId = async (applicationId, excludeId = null) => {
  const normalizedApplicationId = String(applicationId || '').trim();
  if (!normalizedApplicationId) return;

  const query = { 'loanData.applicationId': normalizedApplicationId };
  if (excludeId) query._id = { $ne: excludeId };

  const existingLead = await Lead.findOne(query).select('_id name loanData.applicationId');
  if (existingLead) {
    const error = new Error(`Application ID '${normalizedApplicationId}' is already assigned to lead '${existingLead.name}'.`);
    error.statusCode = 409;
    throw error;
  }
};

const ensureUniqueInverterNumber = async (inverterNumber, excludeId = null) => {
  const normalizedInverterNumber = String(inverterNumber || '').trim();
  if (!normalizedInverterNumber) return;

  const query = { 'installationData.inverterNumber': normalizedInverterNumber };
  if (excludeId) query._id = { $ne: excludeId };

  const existingLead = await Lead.findOne(query).select('_id name installationData.inverterNumber');
  if (existingLead) {
    const error = new Error(`Inverter number '${normalizedInverterNumber}' is already assigned to lead '${existingLead.name}'.`);
    error.statusCode = 409;
    throw error;
  }
};

const ensureUniqueMeterNumber = async (meterNumber, excludeId = null) => {
  const normalizedMeterNumber = String(meterNumber || '').trim();
  if (!normalizedMeterNumber) return;

  const query = { 'netMeteringData.meterNumber': normalizedMeterNumber };
  if (excludeId) query._id = { $ne: excludeId };

  const existingLead = await Lead.findOne(query).select('_id name netMeteringData.meterNumber');
  if (existingLead) {
    const error = new Error(`Meter number '${normalizedMeterNumber}' is already assigned to lead '${existingLead.name}'.`);
    error.statusCode = 409;
    throw error;
  }
};

const buildQuery = (query, user) => {
  const q = {};
  const role = user.role;
  const stageAccess = ROLE_STAGE_MAP[role];
  const isPipelineOwnerRole = ['Manager', 'Sales Manager'].includes(role);
  const completedStage = query.completedStage;
  const salesExecutiveOnly = query.salesExecutiveOnly === 'true';
  const canViewDispatchQueue = role === 'Dispatch Manager' && query.stage === 'Dispatch' && !completedStage;
  const personalHistoryFilter = {
    stage: completedStage || stageAccess,
    action: { $in: ['Approved', 'Completed'] }
  };

  if (role !== 'Admin' && isPipelineOwnerRole && !canViewDispatchQueue && !completedStage && !query.stage && !salesExecutiveOnly) {
    q.$or = [
      { assignedTo: user._id },
      { createdBy: user._id },
      { history: { $elemMatch: { performedBy: user._id } } }
    ];
  } else if (role !== 'Admin' && !canViewDispatchQueue && !completedStage) {
    q.assignedTo = user._id;
  }

  if (stageAccess && role !== 'Admin' && !completedStage && !isPipelineOwnerRole) {
    q.currentStage = stageAccess;
  }

  if (salesExecutiveOnly) {
    if (role !== 'Admin') {
      q.$or = [
        { assignedTo: user._id },
        { createdBy: user._id },
        { history: { $elemMatch: { performedBy: user._id } } }
      ];
      delete q.assignedTo;
    }
    if (role !== 'Sales Executive') q.tags = 'sales-executive';
    delete q.currentStage;
  }

  if (query.stage && !completedStage && (role === 'Admin' || !stageAccess || query.stage === stageAccess)) {
    q.currentStage = query.stage;
  }
  if (completedStage) {
    q.history = {
      $elemMatch: role === 'Admin'
        ? {
            stage: completedStage,
            action: { $in: ['Approved', 'Completed'] }
          }
        : personalHistoryFilter
    };
    if (role !== 'Admin') q.assignedTo = user._id;
  }
  if (query.status) q.status = query.status;
  if (query.source) q.source = query.source;
  if (query.generatedThrough) q.generatedThrough = new RegExp(query.generatedThrough, 'i');
  if (query.city) q.city = new RegExp(query.city, 'i');
  if (query.ivrsNo) q.ivrsNo = new RegExp(query.ivrsNo, 'i');
  if (query.leadId) q.leadId = Number(query.leadId);
  if (query.branch) q.branch = new RegExp(query.branch, 'i');
  if (query.assignedTo && (role === 'Admin' || String(query.assignedTo) === String(user._id))) q.assignedTo = query.assignedTo;
  if (query.priority) q.priority = query.priority;

  if (query.search) {
    q.$or = [
      { name: new RegExp(query.search, 'i') },
      { phone: new RegExp(query.search, 'i') },
      { city: new RegExp(query.search, 'i') },
      { branch: new RegExp(query.search, 'i') },
      { generatedThrough: new RegExp(query.search, 'i') },
      { ivrsNo: new RegExp(query.search, 'i') },
    ];
    if (/^\d+$/.test(String(query.search))) {
      q.$or.push({ leadId: Number(query.search) });
    }
  }

  return q;
};

// @desc    Get all leads (filtered by role)
// @route   GET /api/leads
exports.getLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = buildQuery(req.query, req.user);
    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      'id-asc': { leadId: 1, createdAt: -1 },
      'id-desc': { leadId: -1, createdAt: -1 },
      'name-asc': { name: 1, createdAt: -1 },
      'name-desc': { name: -1, createdAt: -1 },
      'ivrs-asc': { ivrsNo: 1, createdAt: -1 },
      'ivrs-desc': { ivrsNo: -1, createdAt: -1 },
    };
    const sort = sortMap[req.query.sort] || sortMap.latest;

    let leadsQuery = Lead.find(query)
      .populate('assignedTo', 'name role')
      .populate('createdBy', 'name role')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    if (req.query.sort === 'ivrs-asc' || req.query.sort === 'ivrs-desc') {
      leadsQuery = leadsQuery.collation({ locale: 'en', numericOrdering: true });
    }

    const [leads, total] = await Promise.all([
      leadsQuery,
      Lead.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// @desc    Get single lead
// @route   GET /api/leads/:id
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name role phone email')
      .populate('createdBy', 'name role');

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (!canUserViewLead(req.user, lead)) {
      return res.status(403).json({ success: false, message: 'You can only view leads assigned to you.' });
    }
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create lead
// @route   POST /api/leads
exports.createLead = async (req, res) => {
  try {
    const { name, phone, email, address, city, state, pincode, branch, ivrsNo, source, generatedThrough, capacity, roofType, monthlyBill, notes, assignedTo, priority, tags, salesExecutiveData } = req.body;

    await ensureUniqueIvrsNo(ivrsNo);

    let resolvedAssignedTo = assignedTo || req.user._id;
    let assignedManager = null;

    if (isSalesExecutiveLead(req.body)) {
      assignedManager = await getSalesExecutiveManager();
      if (!assignedManager) {
        return res.status(400).json({
          success: false,
          message: 'No active manager found. Please create or activate a manager before submitting this lead.'
        });
      }
      if (assignedManager) {
        resolvedAssignedTo = assignedManager._id;
      }
    }

    const lead = await Lead.create({
      leadId: await getNextLeadId(),
      name, phone, email, address, city, state, pincode, branch, ivrsNo,
      source, generatedThrough, capacity, roofType, monthlyBill, notes, priority, tags,
      salesExecutiveData: isSalesExecutiveLead(req.body) ? salesExecutiveData || {} : undefined,
      assignedTo: resolvedAssignedTo,
      createdBy: req.user._id,
      currentStage: 'Lead',
      status: 'active',
      history: [{
        stage: 'Lead',
        action: 'Created',
        performedBy: req.user._id,
        performedByName: req.user.name,
        note: 'Lead created',
        timestamp: new Date()
      }]
    });

    const uploadedFilePatches = await collectUploadedLeadFilePatches(req, lead._id);
    if (Object.keys(uploadedFilePatches).length) {
      Object.entries(uploadedFilePatches).forEach(([key, patch]) => mergePatch(lead, key, patch));
      await lead.save();
    }

    // Notify assigned user
    if (resolvedAssignedTo && String(resolvedAssignedTo) !== String(req.user._id)) {
      await User.findByIdAndUpdate(resolvedAssignedTo, {
        $push: { notifications: { message: `New lead assigned: ${name}` } }
      });
    }

    if (isSalesExecutiveLead(req.body)) {
      await User.updateMany(
        { role: 'Admin', isActive: true },
        { $push: { notifications: { message: `Sales executive lead submitted: ${name}${ivrsNo ? ` | IVRS ${ivrsNo}` : ''}` } } }
      );

      if (assignedManager && String(assignedManager._id) !== String(req.user._id)) {
        await User.findByIdAndUpdate(assignedManager._id, {
          $push: { notifications: { message: `New sales executive submission received: ${name}${ivrsNo ? ` | IVRS ${ivrsNo}` : ''}` } }
        });
      }
    }

    const populated = await Lead.findById(lead._id)
      .populate('assignedTo', 'name role')
      .populate('createdBy', 'name role');
    res.status(201).json({
      success: true,
      message: isSalesExecutiveLead(req.body) && assignedManager
        ? 'Lead created successfully and sent to manager for approval'
        : 'Lead created successfully',
      data: populated
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.ivrsNo) {
      return res.status(409).json({ success: false, message: 'This IVRS number already exists.' });
    }
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// @desc    Update lead details
// @route   PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (req.user.role !== 'Admin' && String(lead.assignedTo || '') !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only update leads assigned to you.' });
    }

    if (req.body.ivrsNo !== undefined && req.body.ivrsNo !== lead.ivrsNo) {
      await ensureUniqueIvrsNo(req.body.ivrsNo, lead._id);
    }

    if (req.body.installationData?.panelNumber !== undefined) {
      const panelNumber = String(req.body.installationData.panelNumber || '').trim();
      req.body.installationData.panelNumber = panelNumber;
    }

    if (req.body.installationData?.modulePanelNumbers !== undefined) {
      req.body.installationData.modulePanelNumbers = normalizeModulePanelNumbers(req.body.installationData.modulePanelNumbers);
    }

    if (req.body.installationData?.inverterNumber !== undefined) {
      const inverterNumber = String(req.body.installationData.inverterNumber || '').trim();
      req.body.installationData.inverterNumber = inverterNumber;
      if (inverterNumber && inverterNumber !== lead.installationData?.inverterNumber) {
        await ensureUniqueInverterNumber(inverterNumber, lead._id);
      }
    }

    if (req.body.netMeteringData?.meterNumber !== undefined) {
      const meterNumber = String(req.body.netMeteringData.meterNumber || '').trim();
      req.body.netMeteringData.meterNumber = meterNumber;
      if (meterNumber && meterNumber !== lead.netMeteringData?.meterNumber) {
        await ensureUniqueMeterNumber(meterNumber, lead._id);
      }
    }

    const uploadedFilePatches = await collectUploadedLeadFilePatches(req, lead._id);
    mergeUploadedPatchesIntoBody(req.body, uploadedFilePatches);

    const allowed = ['name','phone','email','address','city','state','pincode','branch','ivrsNo','source','generatedThrough','capacity','roofType','monthlyBill','notes','priority','tags'];
    allowed.forEach(field => { if (req.body[field] !== undefined) lead[field] = req.body[field]; });

    [
      'salesExecutiveData',
      'registrationData',
      'bankData',
      'loanData',
      'dispatchData',
      'installationData',
      'netMeteringData',
      'subsidyData',
      'subsidyReadingData',
    ].forEach((key) => mergePatch(lead, key, req.body[key]));

    lead.history.push({
      stage: lead.currentStage,
      action: 'Updated',
      performedBy: req.user._id,
      performedByName: req.user.name,
      note: req.body.updateNote || 'Lead details updated',
      timestamp: new Date()
    });

    await lead.save();

    if (lead.currentStage === 'Completed' && lead.status === 'completed') {
      await Enquiry.findOneAndUpdate(
        { convertedTo: lead._id },
        {
          status: 'converted',
          notes: `Auto-converted after subsidy completion on ${new Date().toLocaleDateString('en-IN')}`,
        }
      );
    }
    res.json({ success: true, message: 'Lead updated', data: lead });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.ivrsNo) {
      return res.status(409).json({ success: false, message: 'This IVRS number already exists.' });
    }
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// @desc    Approve lead — move to next stage
// @route   POST /api/leads/:id/approve
exports.approveLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.status !== 'active') {
      return res.status(400).json({ success: false, message: `Lead is already ${lead.status}` });
    }

    // Enforce stage-role and personal assignment access.
    ensureUserCanActOnLead(req.user, lead, 'approve');

    if (lead.currentStage === 'Lead' && isSalesExecutiveLead(lead) && !['Admin', 'Manager', 'Sales Manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Sales executive leads must be approved by manager before they move to registration.'
      });
    }

    const leadAssignee = lead.assignedTo ? await User.findById(lead.assignedTo).select('role') : null;
    const isSalesManagerHandoff = lead.currentStage === 'Lead'
      && (req.user.role === 'Sales Manager' || leadAssignee?.role === 'Sales Manager');

    if (isSalesManagerHandoff) {
      let managerUser = null;
      if (req.body.nextAssigneeId) {
        managerUser = await User.findOne(assignableUserFilter({
          _id: req.body.nextAssigneeId,
          role: 'Manager',
        }));

        if (!managerUser) {
          return res.status(400).json({
            success: false,
            message: 'Selected user is not available as Manager.'
          });
        }
      } else {
        managerUser = await User.findOne(assignableUserFilter({ role: 'Manager' })).sort({ createdAt: 1 });
      }

      if (!managerUser) {
        return res.status(400).json({ success: false, message: 'No active manager found for assignment.' });
      }

      lead.assignedTo = managerUser._id;
      lead.history.push({
        stage: lead.currentStage,
        action: 'Approved',
        performedBy: req.user._id,
        performedByName: req.user.name,
        note: req.body.note || `Approved by Sales Manager and sent to ${managerUser.name}`,
        timestamp: new Date()
      });
      await lead.save();

      await User.findByIdAndUpdate(managerUser._id, {
        $push: { notifications: { message: `Lead ${lead.name} sent to you by Sales Manager` } }
      });

      const populated = await Lead.findById(lead._id)
        .populate('assignedTo', 'name role')
        .populate('createdBy', 'name role');

      return res.json({ success: true, message: `Lead approved and sent to ${managerUser.name}`, data: populated });
    }

    const prevStage = lead.currentStage;
    lead.approveStage(req.user._id, req.user.name, req.body.note);

    const nextStageRole = getRolesForStage(lead.currentStage)[0];
    let nextStageUser = null;
    if (nextStageRole) {
      if (req.body.nextAssigneeId) {
        nextStageUser = await User.findOne(assignableUserFilter({
          _id: req.body.nextAssigneeId,
          role: nextStageRole,
        })).sort({ createdAt: 1 });

        if (!nextStageUser) {
          return res.status(400).json({
            success: false,
            message: `Selected user is not available for '${lead.currentStage}' stage.`
          });
        }
      } else {
        nextStageUser = await User.findOne(assignableUserFilter({ role: nextStageRole })).sort({ createdAt: 1 });
      }
      lead.assignedTo = nextStageUser ? nextStageUser._id : null;
    } else if (lead.currentStage === 'Completed') {
      lead.assignedTo = null;
    }

    const key = stageDataMap[prevStage];
    const stageData = req.body.stageData ? { ...req.body.stageData } : {};

    if (prevStage === 'Loan Disbursement') {
      const applicationId = String(stageData.applicationId || '').trim();
      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Application number is required for loan approval.' });
      }
      stageData.applicationId = applicationId;
      await ensureUniqueApplicationId(applicationId, lead._id);
    }

    if (prevStage === 'Installation') {
      const panelNumber = String(stageData.panelNumber || '').trim();
      const inverterNumber = String(stageData.inverterNumber || '').trim();

      if (!panelNumber) {
        return res.status(400).json({ success: false, message: 'Panel number is required for installation approval.' });
      }
      if (!inverterNumber) {
        return res.status(400).json({ success: false, message: 'Inverter number is required for installation approval.' });
      }

      stageData.panelNumber = panelNumber;
      stageData.modulePanelNumbers = normalizeModulePanelNumbers(stageData.modulePanelNumbers);
      stageData.inverterNumber = inverterNumber;
      stageData.installedAt = new Date();
      stageData.completedAt = new Date();
      await ensureUniqueInverterNumber(inverterNumber, lead._id);
    }

    if (prevStage === 'Net Metering') {
      const meterNumber = String(stageData.meterNumber || '').trim();
      if (!meterNumber) {
        return res.status(400).json({ success: false, message: 'Meter number is required for net metering approval.' });
      }

      stageData.meterNumber = meterNumber;
      stageData.applicationDate = stageData.applicationDate || new Date();
      stageData.approvedAt = new Date();
      await ensureUniqueMeterNumber(meterNumber, lead._id);
    }

    if (prevStage === 'Subsidy') {
      stageData.receivedAt = new Date();
    }
    if (prevStage === 'Subsidy Reading') {
      stageData.completedAt = new Date();
    }

    const uploadedFilePatches = await collectUploadedLeadFilePatches(req, lead._id);
    Object.entries(uploadedFilePatches).forEach(([target, patch]) => {
      if (target === key) return;
      mergePatch(lead, target, patch);
    });

    if (key) {
      mergePatch(lead, key, {
        ...stageData,
        ...(uploadedFilePatches[key] || {}),
      });
    }

    await lead.save();

    // Notify next stage user
    if (nextStageUser) {
      await User.findByIdAndUpdate(nextStageUser._id, {
        $push: { notifications: { message: `Lead ${lead.name} moved to ${lead.currentStage} stage` } }
      });
    }

    res.json({ success: true, message: `Lead approved. Moved to '${lead.currentStage}'`, data: lead });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.['loanData.applicationId']) {
      return res.status(409).json({ success: false, message: 'This application ID already exists.' });
    }
    if (err.code === 11000 && err.keyPattern?.['installationData.inverterNumber']) {
      return res.status(409).json({ success: false, message: 'This inverter number already exists.' });
    }
    if (err.code === 11000 && err.keyPattern?.['netMeteringData.meterNumber']) {
      return res.status(409).json({ success: false, message: 'This meter number already exists.' });
    }
    res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
};

// @desc    Reject lead
// @route   POST /api/leads/:id/reject
exports.rejectLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.status !== 'active') {
      return res.status(400).json({ success: false, message: `Lead is already ${lead.status}` });
    }

    ensureUserCanActOnLead(req.user, lead, 'reject');

    lead.rejectStage(req.user._id, req.user.name, req.body.note || 'Rejected');
    await lead.save();

    res.json({ success: true, message: 'Lead rejected', data: lead });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// @desc    Transfer lead to another user in the current stage role
// @route   POST /api/leads/:id/transfer
exports.transferLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.status !== 'active') {
      return res.status(400).json({ success: false, message: `Lead is already ${lead.status}` });
    }

    ensureUserCanActOnLead(req.user, lead, 'transfer');

    const targetUser = await User.findOne(assignableUserFilter({
      _id: req.body.userId,
    })).select('name role email');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Selected user not found or inactive.' });
    }

    const allowedRoles = getRolesForStage(lead.currentStage);
    if (!allowedRoles.includes(targetUser.role)) {
      return res.status(400).json({
        success: false,
        message: `Selected user role '${targetUser.role}' cannot handle '${lead.currentStage}' leads.`
      });
    }

    if (String(targetUser._id) === String(lead.assignedTo || '')) {
      return res.status(400).json({ success: false, message: 'Lead is already assigned to this user.' });
    }

    const previousAssignee = lead.assignedTo;
    lead.assignedTo = targetUser._id;
    lead.history.push({
      stage: lead.currentStage,
      action: 'Transferred',
      performedBy: req.user._id,
      performedByName: req.user.name,
      note: req.body.note || `Transferred to ${targetUser.name}`,
      timestamp: new Date()
    });

    await lead.save();

    await User.findByIdAndUpdate(targetUser._id, {
      $push: { notifications: { message: `Lead transferred to you: ${lead.name}` } }
    });

    if (previousAssignee && String(previousAssignee) !== String(req.user._id)) {
      await User.findByIdAndUpdate(previousAssignee, {
        $push: { notifications: { message: `Lead transferred from your queue: ${lead.name}` } }
      });
    }

    const populated = await Lead.findById(lead._id)
      .populate('assignedTo', 'name role')
      .populate('createdBy', 'name role');

    res.json({ success: true, message: `Lead transferred to ${targetUser.name}`, data: populated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// @desc    Add note to lead
// @route   POST /api/leads/:id/note
exports.addNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (req.user.role !== 'Admin' && String(lead.assignedTo || '') !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only add notes to leads assigned to you.' });
    }

    lead.history.push({
      stage: lead.currentStage,
      action: 'Note Added',
      performedBy: req.user._id,
      performedByName: req.user.name,
      note: req.body.note,
      timestamp: new Date()
    });

    await lead.save();
    res.json({ success: true, message: 'Note added', data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete lead (Admin only)
// @route   DELETE /api/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
