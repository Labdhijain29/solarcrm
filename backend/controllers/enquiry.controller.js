const Enquiry = require('../models/Enquiry');
const Lead = require('../models/Lead');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getNextLeadId } = require('../services/leadNumber');

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
    }, { $set: { status: 'converted', convertedTo: lead._id }, $unset: { pendingConversion: 1 } }, { new: true });
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
