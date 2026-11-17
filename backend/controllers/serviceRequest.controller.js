const mongoose = require('mongoose');
const sharp = require('sharp');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Counter = require('../models/Counter');
const storage = require('../services/storage/storageService');
const { uploadFileAsset } = require('../services/storage/fileAsset');
const { normalizeContactPhone } = require('../services/contactPhone');
const { isValidFollowUpDate } = require('../services/enquiryFollowUp');

const statuses = ['pending', 'on-hold', 'completed'];
const scope = user => user.role === 'Admin' ? {} : { assignedTo: user._id };
const fail = (message, statusCode = 400, field) => { throw Object.assign(new Error(message), { statusCode, field }); };
const activity = (user, values) => ({ ...values, performedBy: user._id, performedByName: user.name, timestamp: new Date() });
const text = (value, field, maximum, required = false) => {
  const label = { customerName: 'Customer name', contact: 'Contact number', email: 'Email', address: 'Address', city: 'City', issue: 'Issue', description: 'Issue details', note: 'Note' }[field] || field;
  if (value != null && typeof value !== 'string') fail(`Please enter a valid ${label.toLowerCase()}.`, 400, field);
  const result = String(value || '').trim();
  if (required && !result) fail(`${label} is required.`, 400, field);
  if (result.length > maximum) fail(`${label} must be ${maximum} characters or less.`, 400, field);
  return result;
};
const visitDate = value => {
  if (value == null || value === '') return null;
  if (!isValidFollowUpDate(value)) fail('Please enter a valid visit date.', 400, 'visitDate');
  return value;
};
const detailFields = { customerName: ['Customer name', 120, true], contact: ['Contact number', 20, true], email: ['Email', 254], address: ['Address', 3000], city: ['City', 120], issue: ['Issue', 150, true], description: ['Issue details', 3000], visitDate: ['Visit date'] };
const validateDetails = (body, partial = false) => {
  const values = {};
  for (const [field, [, maximum, required]] of Object.entries(detailFields)) {
    if (partial && !Object.prototype.hasOwnProperty.call(body, field)) continue;
    values[field] = field === 'visitDate' ? visitDate(body[field]) : text(body[field], field, maximum, required);
  }
  if (values.contact !== undefined) {
    values.contact = normalizeContactPhone(values.contact);
    if (!/^\d{10}$/.test(values.contact)) fail('Enter a 10-digit contact number.', 400, 'contact');
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) fail('Enter a valid email address.', 400, 'email');
  return values;
};
const respondError = (res, error) => {
  if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'This request changed while you were working. Refresh it and try again.' });
  const validation = error.name === 'ValidationError';
  const message = validation ? Object.values(error.errors)[0].message : error.statusCode ? error.message : 'Could not save the service request. Please try again.';
  return res.status(error.statusCode || (validation ? 400 : 500)).json({ success: false, message, errors: error.field ? [{ field: error.field, message }] : [] });
};
const serialize = request => request.populate([{ path: 'assignedTo', select: 'name role' }, { path: 'createdBy', select: 'name role' }]);

// Uploaded assets are removed only after confirming that no saved request references them.
const cleanUnused = async photos => {
  for (const photo of photos) {
    try {
      if (!await ServiceRequest.exists({ 'history.photos.fileKey': photo.fileKey })) await storage.delete(photo.fileKey);
    } catch { /* Keep the asset if the database or storage cannot confirm cleanup. */ }
  }
};
const uploadPhotos = async (files, photos) => {
  for (const file of files || []) {
    let metadata;
    try { metadata = await sharp(file.buffer).metadata(); }
    catch { fail('Please upload valid JPG, PNG or WEBP photos.'); }
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) fail('Please upload JPG, PNG or WEBP photos.');
    photos.push(await uploadFileAsset(file, { folder: 'service-requests' }));
  }
};
const nextNumber = async () => {
  let counter;
  try { counter = await Counter.findByIdAndUpdate('serviceRequestNumber', { $inc: { seq: 1 } }, { upsert: true, new: true }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    counter = await Counter.findByIdAndUpdate('serviceRequestNumber', { $inc: { seq: 1 } }, { new: true });
  }
  return `SR-${String(counter.seq).padStart(6, '0')}`;
};

exports.loadRequest = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) fail('Invalid service request.', 400);
    const request = await ServiceRequest.findOne({ _id: req.params.id, ...scope(req.user) });
    if (!request) fail('Service request not found or not assigned to you.', 404);
    req.serviceRequest = request;
    next();
  } catch (error) { respondError(res, error); }
};

exports.getManagers = async (_req, res) => {
  try {
    const data = await User.find({ role: 'Service Manager', isActive: { $ne: false }, approvalStatus: { $ne: 'rejected' } }).select('name role').sort({ name: 1 });
    res.json({ success: true, data });
  } catch (error) { respondError(res, error); }
};

exports.list = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    if (status !== 'All' && !statuses.includes(status)) fail('Please select a valid service status.');
    const base = scope(req.user);
    if (req.query.search) {
      const pattern = new RegExp(String(req.query.search).slice(0, 150).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      base.$or = ['requestNo', 'customerName', 'contact', 'city', 'issue'].map(field => ({ [field]: pattern }));
    }
    const query = status === 'All' ? base : { ...base, status };
    const [total, counts] = await Promise.all([
      ServiceRequest.countDocuments(query),
      ServiceRequest.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const pages = Math.max(1, Math.ceil(total / 25));
    const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    const data = await ServiceRequest.find(query).select('-history').populate('assignedTo', 'name role').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25);
    res.json({ success: true, data, counts: Object.fromEntries(counts.map(item => [item._id, item.count])), pagination: { page, pages, total, limit: 25 } });
  } catch (error) { respondError(res, error); }
};

exports.getOne = async (req, res) => {
  try { res.json({ success: true, data: await serialize(req.serviceRequest) }); }
  catch (error) { respondError(res, error); }
};

exports.create = async (req, res) => {
  const photos = [];
  try {
    const body = req.body;
    const values = validateDetails(body);
    const assignedTo = req.user.role === 'Admin' ? body.assignedTo : req.user._id;
    if (req.user.role !== 'Admin' && body.assignedTo && String(body.assignedTo) !== String(req.user._id)) fail('You can create requests only for yourself.', 403);
    if (!mongoose.isValidObjectId(assignedTo)) fail('Select a Service Manager.', 400, 'assignedTo');
    const manager = await User.findOne({ _id: assignedTo, role: 'Service Manager', isActive: { $ne: false }, approvalStatus: { $ne: 'rejected' } });
    if (!manager) fail('Select an active Service Manager.', 400, 'assignedTo');
    await uploadPhotos(req.files, photos);
    const request = new ServiceRequest({ ...values, requestNo: await nextNumber(), assignedTo, createdBy: req.user._id, status: 'pending', history: [activity(req.user, { action: 'Created', toStatus: 'pending', visitDate: values.visitDate, photos, note: values.description })] });
    await serialize(request);
    await request.save();
    res.status(201).json({ success: true, message: 'Service request created.', data: request });
  } catch (error) { await cleanUnused(photos); respondError(res, error); }
};

exports.updateDetails = async (req, res) => {
  try {
    const request = req.serviceRequest;
    const forbidden = Object.keys(req.body).find(field => field !== 'expectedVersion' && !Object.prototype.hasOwnProperty.call(detailFields, field));
    if (forbidden) fail('Only customer details, issue details and visit date can be edited.');
    if (!Number.isInteger(req.body.expectedVersion) || req.body.expectedVersion !== request.__v) fail('This request changed. Close Edit and reopen it to load the latest details.', 409);
    const values = validateDetails(req.body, true);
    const changes = [];
    for (const [field, value] of Object.entries(values)) {
      const oldValue = String(request[field] ?? '');
      const newValue = String(value ?? '');
      if (oldValue !== newValue) changes.push({ field, label: detailFields[field][0], oldValue, newValue });
    }
    if (!changes.length) fail('No details have changed.');
    Object.assign(request, values);
    request.history.push(activity(req.user, { action: 'Details Edited', changes }));
    await serialize(request);
    await request.save();
    res.json({ success: true, message: 'Service request updated.', data: request });
  } catch (error) { respondError(res, error); }
};

exports.addActivity = async (req, res) => {
  const photos = [];
  try {
    const request = req.serviceRequest;
    const note = text(req.body.note, 'note', 3000);
    const hasVisit = Object.prototype.hasOwnProperty.call(req.body, 'visitDate');
    const nextVisit = hasVisit ? visitDate(req.body.visitDate) : request.visitDate;
    const visitChanged = nextVisit !== request.visitDate;
    if (!note && !req.files?.length && !visitChanged) fail('Add a note, photos or a different visit date.');
    await uploadPhotos(req.files, photos);
    request.history.push(activity(req.user, { action: visitChanged ? 'Visit Updated' : note ? 'Note Added' : 'Photos Added', note, photos, ...(visitChanged ? { previousVisitDate: request.visitDate, visitDate: nextVisit } : {}) }));
    request.visitDate = nextVisit;
    await serialize(request);
    await request.save();
    res.json({ success: true, message: 'Service update saved.', data: request });
  } catch (error) { await cleanUnused(photos); respondError(res, error); }
};

exports.setStatus = async (req, res) => {
  try {
    const request = req.serviceRequest;
    const { status, currentStatus } = req.body;
    if (!statuses.includes(status)) fail('Select a valid service status.');
    if (currentStatus !== request.status) fail('The status changed. Refresh this request and try again.', 409);
    if (status === request.status) fail('This request already has that status.');
    if (request.status === 'completed' && status !== 'pending') fail('Reopen the request as Pending first.');
    const note = text(req.body.note, 'note', 3000);
    if (status === 'completed' && !note) fail('A completion note is required.', 400, 'note');
    const action = request.status === 'completed' ? 'Reopened' : status === 'completed' ? 'Completed' : status === 'on-hold' ? 'On Hold' : 'Resumed';
    request.history.push(activity(req.user, { action, note, fromStatus: request.status, toStatus: status }));
    request.status = status;
    request.completedAt = status === 'completed' ? new Date() : null;
    await serialize(request);
    await request.save();
    res.json({ success: true, message: status === 'completed' ? 'Service request completed.' : status === 'on-hold' ? 'Service request put on hold.' : 'Service request is Pending.', data: request });
  } catch (error) { respondError(res, error); }
};
