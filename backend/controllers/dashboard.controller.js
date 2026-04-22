const Lead = require('../models/Lead');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const { STAGES } = require('../models/Lead');
const { ROLE_STAGE_MAP } = require('../middleware/auth.middleware');
const { buildEnquiryQueryForRole } = require('./enquiry.controller');

const isSingleStageRole = (role) => {
  const stageAccess = ROLE_STAGE_MAP[role];
  return Boolean(stageAccess) && !['Manager', 'Sales Manager'].includes(role);
};

const buildPersonalLeadQuery = (user) => {
  if (user.role === 'Admin') return {};
  const query = {};
  if (!isSingleStageRole(user.role)) {
    query.$or = [
      { assignedTo: user._id },
      { createdBy: user._id }
    ];
  }
  const stageAccess = ROLE_STAGE_MAP[user.role];
  if (stageAccess) query.currentStage = stageAccess;
  return query;
};

const buildPersonalEnquiryQuery = (user) => {
  return buildEnquiryQueryForRole(user);
};

// @desc    Get dashboard stats (role-aware)
// @route   GET /api/dashboard/stats
exports.getStats = async (req, res) => {
  try {
    const baseQuery = buildPersonalLeadQuery(req.user);
    const enquiryQuery = buildPersonalEnquiryQuery(req.user);

    const [total, active, completed, rejected, enquiries, users] = await Promise.all([
      Lead.countDocuments(baseQuery),
      Lead.countDocuments({ ...baseQuery, status: 'active' }),
      Lead.countDocuments({ ...baseQuery, status: 'completed' }),
      Lead.countDocuments({ ...baseQuery, status: 'rejected' }),
      Enquiry.countDocuments(enquiryQuery),
      User.countDocuments({ isActive: true }),
    ]);

    // Stage distribution
    const stageData = await Lead.aggregate([
      { $match: { ...baseQuery, status: 'active' } },
      { $group: { _id: '$currentStage', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const stageCounts = {};
    STAGES.forEach(s => stageCounts[s] = 0);
    stageData.forEach(d => stageCounts[d._id] = d.count);

    // Source distribution
    const sourceData = await Lead.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Monthly leads (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyData = await Lead.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        summary: { total, active, completed, rejected, enquiries, users, conversionRate },
        stageCounts,
        stageData: STAGES.map(s => ({ name: s, count: stageCounts[s] })),
        sourceData: sourceData.map(d => ({ name: d._id, value: d.count })),
        monthlyData: monthlyData.map(d => ({
          month: new Date(d._id.year, d._id.month - 1).toLocaleString('en-IN', { month: 'short' }),
          leads: d.count
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get recent activity
// @route   GET /api/dashboard/activity
exports.getActivity = async (req, res) => {
  try {
    const leads = await Lead.find(buildPersonalLeadQuery(req.user))
      .select('name history currentStage status')
      .sort({ updatedAt: -1 })
      .limit(30);

    const activity = [];
    leads.forEach(lead => {
      const latest = lead.history[lead.history.length - 1];
      if (latest) {
        activity.push({
          leadId: lead._id,
          leadName: lead.name,
          stage: latest.stage,
          action: latest.action,
          by: latest.performedByName,
          note: latest.note,
          timestamp: latest.timestamp
        });
      }
    });

    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, data: activity.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
