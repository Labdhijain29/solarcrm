const Enquiry = require('../models/Enquiry');
const Lead = require('../models/Lead');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getNextLeadId } = require('../services/leadNumber');
const { indiaToday, isValidFollowUpDate } = require('../services/enquiryFollowUp');

const isServiceEnquiryType = (value = '') => value.trim().toLowerCase() === 'service enquiry';

const buildEnquiryQueryForRole = (user) => {
  if (['Admin', 'Manager', 'Enquiry Executive'].includes(user.role)) return {};
  if (['Sales Executive', 'Sales Manager'].includes(user.role)) {
    return { enquiryType: { $not: /^service enquiry$/i } };
  }
  if (user.role === 'Service Manager') {
    return { enquiryType: /^service enquiry$/i };
  }
  return { $or: [{ assignedTo: user._id }, { assignedTo: null }] };
};

exports.getEnquiries = async (req, res) => {
  try {
    const q = buildEnquiryQueryForRole(req.user);
    if (req.query.status) q.status = req.query.status;
    const enquiries = await Enquiry.find(q).populate('assignedTo', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: enquiries });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDueFollowUps = async (req, res) => {
  try {
    const today = indiaToday();
    const visible = buildEnquiryQueryForRole(req.user);
    const base = { ...visible, convertedTo: null, status: { $nin: ['converted', 'closed'] } };
    const [dueToday, overdue, items] = await Promise.all([
      Enquiry.countDocuments({ ...base, nextFollowUpDate: today }),
      Enquiry.countDocuments({ ...base, nextFollowUpDate: { $lt: today, $ne: null } }),
      Enquiry.find({ ...base, nextFollowUpDate: { $lte: today, $ne: null } })
        .select('name contact phone nextFollowUpDate enquiryType').sort({ nextFollowUpDate: 1, _id: 1 }).limit(8),
    ]);
    res.json({ success: true, data: { today, dueToday, overdue, total: dueToday + overdue, items } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addFollowUp = async (req, res) => {
  try {
    const note = String(req.body.note || '').trim();
    const completed = req.body.completed === true;
    const dueDate = completed ? null : req.body.dueDate;
    if (!note || note.length > 2000) {
      return res.status(400).json({ success: false, message: 'Write a note of up to 2,000 characters.' });
    }
    if (!completed && (!isValidFollowUpDate(dueDate) || dueDate < indiaToday())) {
      return res.status(400).json({ success: false, message: 'Choose today or a later date for the reminder.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid enquiry ID.' });
    }
    const followUp = {
      _id: new mongoose.Types.ObjectId(), note, dueDate, completed,
      createdBy: req.user._id, createdByName: req.user.name, createdAt: new Date(),
    };
    const enquiry = await Enquiry.findOneAndUpdate({
      ...buildEnquiryQueryForRole(req.user), _id: req.params.id,
      convertedTo: null, status: { $nin: ['converted', 'closed'] }, pendingConversion: null,
    }, { $push: { followUps: followUp }, $set: { nextFollowUpDate: dueDate }, $inc: { __v: 1 } },
    { new: true, runValidators: true });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry is unavailable, closed, or already converted.' });
    res.status(201).json({ success: true, message: completed ? 'Follow-up saved. Reminder removed.' : 'Follow-up and date saved.', data: enquiry });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createEnquiry = async (req, res) => {
  try {
    const { name, contact, email, address, enquiryType, state, city, pincode } = req.body;
    const normalizedContact = String(contact || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
    const enquiry = await Enquiry.create({
      createdBy: req.user?._id || null,
      name,
      contact: normalizedContact,
      phone: normalizedContact,
      email,
      address,
      enquiryType,
      state,
      city,
      pincode,
      source: 'Website',
    });
    res.status(201).json({ success: true, message: 'Enquiry submitted! We will contact you shortly.', data: enquiry });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.convertToLead = async (req, res) => {
  try {
    let enquiry = await Enquiry.findById(req.params.id).select('+pendingConversion');
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (enquiry.convertedTo || enquiry.status === 'converted') return res.status(400).json({ success: false, message: 'Lead already created for this enquiry' });
    if (isServiceEnquiryType(enquiry.enquiryType)) {
      return res.status(400).json({ success: false, message: 'Service enquiries cannot be converted to leads' });
    }
    // Ensure only this new index, without coupling conversion to unrelated legacy indexes.
    await Lead.collection.createIndex({ sourceEnquiry: 1 }, { unique: true, sparse: true });

    if (!enquiry.pendingConversion) {
      const executive = req.user.role === 'Enquiry Executive';
      const manager = executive ? await User.findOne({
        role: 'Manager', isActive: true, approvalStatus: 'approved',
      }).sort({ createdAt: 1, _id: 1 }) : null;
      if (executive && !manager) {
        return res.status(409).json({ success: false, message: 'No active, approved Manager is available. Please contact Admin before converting this enquiry.' });
      }
      const leadData = {
        _id: new mongoose.Types.ObjectId(),
        leadId: await getNextLeadId(), sourceEnquiry: enquiry._id,
        name: enquiry.name, phone: enquiry.contact || enquiry.phone, email: enquiry.email,
        address: enquiry.address, city: enquiry.city, state: enquiry.state, pincode: enquiry.pincode,
        source: 'Website',
        notes: `Enquiry Type: ${enquiry.enquiryType}\nAddress: ${enquiry.address || '-'}\nState: ${enquiry.state || '-'}\nPincode: ${enquiry.pincode || '-'}`,
        assignedTo: manager?._id || req.user._id, createdBy: req.user._id,
        currentStage: 'Lead', status: 'active',
        history: [{ stage: 'Lead', action: 'Created', performedBy: req.user._id, performedByName: req.user.name,
          note: manager ? `Converted from enquiry and assigned to ${manager.name}` : 'Converted from website enquiry' }],
      };
      await new Lead(leadData).validate();
      // Snapshot and reserve atomically. A simultaneous edit/delete or conversion cannot win too.
      const claimed = await Enquiry.findOneAndUpdate({
        _id: enquiry._id, __v: enquiry.__v ?? null, updatedAt: enquiry.updatedAt, convertedTo: null,
        status: { $ne: 'converted' }, pendingConversion: null,
      }, { $set: { pendingConversion: { leadData, notifyManager: executive } }, $inc: { __v: 1 } }, { new: true }).select('+pendingConversion');
      enquiry = claimed || await Enquiry.findById(req.params.id).select('+pendingConversion');
      if (!enquiry?.pendingConversion) {
        return res.status(409).json({ success: false, message: 'Enquiry changed. Refresh the list before converting.' });
      }
    }

    // A durable snapshot and fixed _id allow safe retries even after a process restart.
    // Keep the reservation on failure: retry resumes it, rather than creating another lead.
    const { leadData, notifyManager } = enquiry.pendingConversion;
    let lead;
    try {
      lead = await Lead.findOneAndUpdate({ _id: leadData._id }, { $setOnInsert: leadData }, {
        new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      lead = await Lead.findOne({ sourceEnquiry: enquiry._id });
      if (!lead) throw error;
    }
    const finalized = await Enquiry.findOneAndUpdate({
      _id: enquiry._id, 'pendingConversion.leadData._id': leadData._id,
    }, { $set: { status: 'converted', convertedTo: lead._id, nextFollowUpDate: null }, $unset: { pendingConversion: 1 } }, { new: true });
    if (finalized && notifyManager) {
      await User.findByIdAndUpdate(lead.assignedTo, {
        $push: { notifications: { message: `Enquiry converted: ${lead.name} is ready in your Leads queue` } },
      }).catch(error => console.error('Enquiry handoff notification failed:', error.message));
    }

    res.json({ success: true, message: req.user.role === 'Enquiry Executive'
      ? 'Lead created and sent to the Manager' : 'Lead created from enquiry',
    data: req.user.role === 'Enquiry Executive' ? { leadId: lead.leadId, currentStage: lead.currentStage } : lead });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateEnquiry = async (req, res) => {
  try {
    if (req.user.role === 'Enquiry Executive' && (req.body.status === 'converted'
      || ['createdBy', 'convertedTo', 'pendingConversion'].some(key => req.body[key] !== undefined))) {
      return res.status(403).json({ success: false, message: 'Ownership and conversion fields cannot be edited.' });
    }
    const allowedUpdates = ['name', 'contact', 'phone', 'email', 'address', 'enquiryType', 'state', 'city', 'pincode', 'status', 'notes'];
    const updates = allowedUpdates.reduce((acc, key) => {
      if (req.body[key] !== undefined) acc[key] = req.body[key];
      return acc;
    }, {});

    if (updates.contact !== undefined) {
      const normalizedContact = String(updates.contact || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
      updates.contact = normalizedContact;
      updates.phone = normalizedContact;
    }
    if (['converted', 'closed'].includes(updates.status)) updates.nextFollowUpDate = null;

    const enquiry = await Enquiry.findOneAndUpdate(mutationQuery(req), { $set: updates, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!enquiry) return mutationDenied(res);
    res.json({ success: true, data: enquiry });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndDelete(mutationQuery(req));
    if (!enquiry) return mutationDenied(res);
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const mutationQuery = (req) => ({
  _id: req.params.id, pendingConversion: null,
  ...(req.user.role === 'Enquiry Executive' ? {
    createdBy: req.user._id, convertedTo: null, status: { $ne: 'converted' },
  } : {}),
});
const mutationDenied = (res) => res.status(403).json({ success: false,
  message: 'Enquiry is unavailable, conversion is in progress, or you do not have permission to change it.' });

exports.buildEnquiryQueryForRole = buildEnquiryQueryForRole;
exports.isServiceEnquiryType = isServiceEnquiryType;
