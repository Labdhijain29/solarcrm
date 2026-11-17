const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { STAGES } = require('../models/Lead');

const escapePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = { name: 1, phone: 1, leadId: 1, ivrsNo: 1, city: 1, capacity: 1, currentStage: 1, status: 1, assignedTo: 1, stageEnteredAt: 1 };

// Keep counts, previews and pages within the same pipeline ownership scope.
exports.getPipeline = async (req, res) => {
  try {
    const scope = req.user.role === 'Admin' ? {} : { $or: [
      { assignedTo: req.user._id }, { createdBy: req.user._id },
      { salesExecutiveAssignee: req.user._id }, { 'history.performedBy': req.user._id },
    ] };
    const filters = [];
    if (req.query.status && req.query.status !== 'All') {
      if (!['active', 'on-hold', 'completed', 'rejected'].includes(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      filters.push({ status: req.query.status });
    }
    if (req.query.city) filters.push({ city: req.query.city });
    if (req.query.assignedTo) {
      if (!mongoose.isValidObjectId(req.query.assignedTo)) return res.status(400).json({ success: false, message: 'Invalid executive filter.' });
      filters.push({ assignedTo: new mongoose.Types.ObjectId(req.query.assignedTo) });
    }
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 150);
      const pattern = new RegExp(escapePattern(search), 'i');
      const matches = ['name', 'phone', 'ivrsNo', 'city'].map(key => ({ [key]: pattern }));
      if (/^\d+$/.test(search)) matches.push({ leadId: Number(search) });
      filters.push({ $or: matches });
    }
    const query = { $and: [scope, ...filters] };
    const stageEnteredAt = { $ifNull: [{ $max: { $map: {
      input: { $filter: { input: { $ifNull: ['$history', []] }, as: 'entry', cond: { $and: [
        { $eq: ['$$entry.stage', '$currentStage'] },
        { $in: ['$$entry.action', ['Created', 'In Progress', 'Completed']] },
      ] } } }, as: 'entry', in: '$$entry.timestamp',
    } } }, '$createdAt'] };
    const sort = req.query.sort === 'latest' ? { stageEnteredAt: -1, _id: -1 } : { stageEnteredAt: 1, _id: 1 };
    const base = [{ $match: query }, { $addFields: { stageEnteredAt } }];

    if (req.query.stage) {
      if (!STAGES.includes(req.query.stage)) return res.status(400).json({ success: false, message: 'Invalid pipeline stage.' });
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const stageQuery = { $and: [query, { currentStage: req.query.stage }] };
      const total = await Lead.countDocuments(stageQuery);
      const pages = Math.max(1, Math.ceil(total / 25));
      const resolvedPage = Math.min(page, pages);
      const data = await Lead.aggregate([...base, { $match: { currentStage: req.query.stage } }, { $sort: sort }, { $skip: (resolvedPage - 1) * 25 }, { $limit: 25 }, { $project: fields }]);
      await Lead.populate(data, { path: 'assignedTo', select: 'name role' });
      return res.json({ success: true, data, pagination: { page: resolvedPage, limit: 25, total, pages } });
    }

    const previews = Object.fromEntries(STAGES.map((stage, index) => [`stage${index}`, [
      { $match: { currentStage: stage } }, { $sort: sort }, { $limit: 5 }, { $project: fields },
    ]]));
    const [result] = await Lead.aggregate([...base, { $facet: {
      counts: [{ $group: { _id: '$currentStage', total: { $sum: 1 } } }], ...previews,
    } }]);
    const stages = STAGES.map((stage, index) => ({ stage, total: result.counts.find(item => item._id === stage)?.total || 0, leads: result[`stage${index}`] }));
    await Lead.populate(stages.flatMap(item => item.leads), { path: 'assignedTo', select: 'name role' });
    const [options] = await Lead.aggregate([{ $match: scope }, { $facet: {
      cities: [{ $match: { city: { $nin: ['', null] } } }, { $group: { _id: '$city' } }, { $sort: { _id: 1 } }],
      executives: [{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: '$assignedTo' } }],
    } }]);
    const executives = options.executives.map(item => ({ assignedTo: item._id }));
    await Lead.populate(executives, { path: 'assignedTo', select: 'name role' });
    res.json({ success: true, data: stages, options: {
      cities: options.cities.map(item => item._id),
      executives: executives.map(item => item.assignedTo).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
    } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load pipeline. Please try again.' });
  }
};
