const Enquiry = require('../models/Enquiry');
const Lead = require('../models/Lead');

const isServiceEnquiryType = (value = '') => value.trim().toLowerCase() === 'service enquiry';

const buildEnquiryQueryForRole = (user) => {
  if (['Admin', 'Manager'].includes(user.role)) return {};
  if (user.role === 'Sales Manager') {
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
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (enquiry.convertedTo) return res.status(400).json({ success: false, message: 'Lead already created for this enquiry' });
    if (isServiceEnquiryType(enquiry.enquiryType)) {
      return res.status(400).json({ success: false, message: 'Service enquiries cannot be converted to leads' });
    }

    const lead = await Lead.create({
      name: enquiry.name,
      phone: enquiry.contact || enquiry.phone,
      email: enquiry.email,
      city: enquiry.city,
      source: 'Website',
      notes: `Enquiry Type: ${enquiry.enquiryType}\nAddress: ${enquiry.address || '-'}\nState: ${enquiry.state || '-'}\nPincode: ${enquiry.pincode || '-'}`,
      assignedTo: req.user._id,
      createdBy: req.user._id,
      currentStage: 'Lead', status: 'active',
      history: [{ stage: 'Lead', action: 'Created', performedBy: req.user._id, performedByName: req.user.name, note: 'Converted from website enquiry' }]
    });

    enquiry.status = 'converted';
    enquiry.convertedTo = lead._id;
    await enquiry.save();

    res.json({ success: true, message: 'Lead created from enquiry', data: lead });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateEnquiry = async (req, res) => {
  try {
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

    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: enquiry });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.buildEnquiryQueryForRole = buildEnquiryQueryForRole;
exports.isServiceEnquiryType = isServiceEnquiryType;
