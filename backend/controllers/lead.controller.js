const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');

const isSingleStageRole = (role) => {
  const stageAccess = ROLE_STAGE_MAP[role];
  return Boolean(stageAccess) && !['Manager', 'Sales Manager'].includes(role);
};

const buildQuery = (query, user) => {
  const q = {};
  const role = user.role;
  const stageAccess = ROLE_STAGE_MAP[role];

  if (role !== 'Admin' && !isSingleStageRole(role)) {
    q.$or = [
      { assignedTo: user._id },
      { createdBy: user._id }
    ];
  }

  if (stageAccess && role !== 'Admin') {
    q.currentStage = stageAccess;
  }

  if (query.stage) q.currentStage = query.stage;
  if (query.status) q.status = query.status;
  if (query.source) q.source = query.source;
  if (query.city) q.city = new RegExp(query.city, 'i');
  if (query.assignedTo) q.assignedTo = query.assignedTo;
  if (query.priority) q.priority = query.priority;

  if (query.search) {
    q.$or = [
      { name: new RegExp(query.search, 'i') },
      { phone: new RegExp(query.search, 'i') },
      { city: new RegExp(query.search, 'i') },
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
    const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

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
    const { name, phone, email, address, city, state, pincode, source, capacity, roofType, monthlyBill, notes, assignedTo, priority } = req.body;

    const lead = await Lead.create({
      name, phone, email, address, city, state, pincode,
      source, capacity, roofType, monthlyBill, notes, priority,
      assignedTo: assignedTo || req.user._id,
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
    if (assignedTo) {
      await User.findByIdAndUpdate(assignedTo, {
        $push: { notifications: { message: `New lead assigned: ${name}` } }
      });
    }

    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name role');
    res.status(201).json({ success: true, message: 'Lead created successfully', data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update lead details
// @route   PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const allowed = ['name','phone','email','address','city','state','pincode','source','capacity','roofType','monthlyBill','notes','assignedTo','priority','tags'];
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
    res.status(500).json({ success: false, message: err.message });
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
      const dataKey = `${lead.currentStage.split(' ')[0].toLowerCase()}Data`;
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
      if (key) lead[key] = { ...lead[key], ...req.body.stageData };
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
