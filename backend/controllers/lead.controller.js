const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');

const isSingleStageRole = (role) => {
  const stageAccess = ROLE_STAGE_MAP[role];
  return Boolean(stageAccess) && !['Manager', 'Sales Executive', 'Sales Manager'].includes(role);
};

const isSalesExecutiveLead = (payload = {}) => {
  return Array.isArray(payload.tags) && payload.tags.includes('sales-executive');
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
  return User.findOne({ role: 'Manager', isActive: true }).sort({ createdAt: 1 });
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

const buildQuery = (query, user) => {
  const q = {};
  const role = user.role;
  const stageAccess = ROLE_STAGE_MAP[role];
  const completedStage = query.completedStage;
  const salesExecutiveOnly = query.salesExecutiveOnly === 'true';
  const personalHistoryFilter = {
    performedBy: user._id,
    stage: completedStage || stageAccess,
    action: { $in: ['Approved', 'Completed'] }
  };

  if (role !== 'Admin' && isSingleStageRole(role)) {
    q.assignedTo = user._id;
  }

  if (role !== 'Admin' && !isSingleStageRole(role)) {
    q.$or = [
      { assignedTo: user._id },
      { createdBy: user._id }
    ];
  }

  if (stageAccess && role !== 'Admin' && !completedStage) {
    q.currentStage = stageAccess;
  }

  if (role === 'Sales Executive' && salesExecutiveOnly) {
    q.$or = [
      { assignedTo: user._id },
      { createdBy: user._id }
    ];
    q.tags = 'sales-executive';
    delete q.currentStage;
  }

  if (query.stage && !completedStage) q.currentStage = query.stage;
  if (completedStage) {
    q.history = {
      $elemMatch: role === 'Admin'
        ? {
            stage: completedStage,
            action: { $in: ['Approved', 'Completed'] }
          }
        : personalHistoryFilter
    };
    delete q.assignedTo;
  }
  if (query.status) q.status = query.status;
  if (query.source) q.source = query.source;
  if (query.generatedThrough) q.generatedThrough = new RegExp(query.generatedThrough, 'i');
  if (query.city) q.city = new RegExp(query.city, 'i');
  if (query.ivrsNo) q.ivrsNo = new RegExp(query.ivrsNo, 'i');
  if (query.assignedTo) q.assignedTo = query.assignedTo;
  if (query.priority) q.priority = query.priority;

  if (query.search) {
    q.$or = [
      { name: new RegExp(query.search, 'i') },
      { phone: new RegExp(query.search, 'i') },
      { city: new RegExp(query.search, 'i') },
      { generatedThrough: new RegExp(query.search, 'i') },
      { ivrsNo: new RegExp(query.search, 'i') },
    ];
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
      'name-asc': { name: 1, createdAt: -1 },
      'name-desc': { name: -1, createdAt: -1 },
      'ivrs-asc': { ivrsNo: 1, createdAt: -1 },
      'ivrs-desc': { ivrsNo: -1, createdAt: -1 },
    };
    const sort = sortMap[req.query.sort] || sortMap.latest;

    const [leads, total] = await Promise.all([
      Lead.find(query).populate('assignedTo', 'name role').sort(sort).skip(skip).limit(limit),
      Lead.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create lead
// @route   POST /api/leads
exports.createLead = async (req, res) => {
  try {
    const { name, phone, email, address, city, state, pincode, ivrsNo, source, generatedThrough, capacity, roofType, monthlyBill, notes, assignedTo, priority, tags, salesExecutiveData } = req.body;

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
      name, phone, email, address, city, state, pincode, ivrsNo,
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

    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name role');
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

    if (req.body.ivrsNo !== undefined && req.body.ivrsNo !== lead.ivrsNo) {
      await ensureUniqueIvrsNo(req.body.ivrsNo, lead._id);
    }

    const allowed = ['name','phone','email','address','city','state','pincode','ivrsNo','source','generatedThrough','capacity','roofType','monthlyBill','notes','assignedTo','priority','tags','salesExecutiveData'];
    allowed.forEach(field => { if (req.body[field] !== undefined) lead[field] = req.body[field]; });

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

    // Enforce stage-role access
    const userStage = ROLE_STAGE_MAP[req.user.role];
    if (req.user.role !== 'Admin' && userStage !== lead.currentStage) {
      return res.status(403).json({
        success: false,
        message: `You can only approve leads at '${userStage}' stage. This lead is at '${lead.currentStage}'.`
      });
    }

    if (lead.currentStage === 'Lead' && isSalesExecutiveLead(lead) && !['Admin', 'Manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Sales executive leads must be approved by manager before they move to registration.'
      });
    }

    const prevStage = lead.currentStage;
    lead.approveStage(req.user._id, req.user.name, req.body.note);

    const nextStageRole = Object.keys(ROLE_STAGE_MAP).find(r => ROLE_STAGE_MAP[r] === lead.currentStage);
    let nextStageUser = null;
    if (nextStageRole) {
      nextStageUser = await User.findOne({ role: nextStageRole, isActive: true }).sort({ createdAt: 1 });
      lead.assignedTo = nextStageUser ? nextStageUser._id : null;
    } else if (lead.currentStage === 'Completed') {
      lead.assignedTo = null;
    }

    // Save stage-specific data if provided
    if (req.body.stageData) {
      // Map stage names to data keys
      const stageDataMap = {
        'Registration': 'registrationData',
        'Bank Approval': 'bankData',
        'Loan Disbursement': 'loanData',
        'Dispatch': 'dispatchData',
        'Installation': 'installationData',
        'Net Metering': 'netMeteringData',
        'Subsidy': 'subsidyData',
      };
      const key = stageDataMap[prevStage];
      if (prevStage === 'Loan Disbursement') {
        const applicationId = String(req.body.stageData.applicationId || '').trim();
        if (!applicationId) {
          return res.status(400).json({ success: false, message: 'Application number is required for loan approval.' });
        }
        req.body.stageData.applicationId = applicationId;
        await ensureUniqueApplicationId(applicationId, lead._id);
      }
      if (key) lead[key] = { ...lead[key], ...req.body.stageData };
    } else if (prevStage === 'Loan Disbursement') {
      return res.status(400).json({ success: false, message: 'Application number is required for loan approval.' });
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
    res.status(400).json({ success: false, message: err.message });
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

    const userStage = ROLE_STAGE_MAP[req.user.role];
    if (req.user.role !== 'Admin' && userStage !== lead.currentStage) {
      return res.status(403).json({ success: false, message: 'You cannot reject this lead at its current stage.' });
    }

    lead.rejectStage(req.user._id, req.user.name, req.body.note || 'Rejected');
    await lead.save();

    res.json({ success: true, message: 'Lead rejected', data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Add note to lead
// @route   POST /api/leads/:id/note
exports.addNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

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
