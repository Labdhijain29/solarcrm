const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  fileUrl: String, fileKey: String, provider: String, resourceType: String,
  deliveryType: String, originalName: String, mimeType: String, size: Number,
}, { _id: false });

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true },
  note: { type: String, default: '', maxlength: 3000 },
  photos: [photoSchema],
  fromStatus: String, toStatus: String,
  previousVisitDate: String, visitDate: String,
  changes: [{ field: String, label: String, oldValue: String, newValue: String, _id: false }],
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const schema = new mongoose.Schema({
  requestNo: { type: String, required: true, unique: true, immutable: true },
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  contact: { type: String, required: true, match: /^\d{10}$/ },
  email: { type: String, trim: true, default: '', maxlength: 254 },
  address: { type: String, trim: true, default: '', maxlength: 3000 },
  city: { type: String, trim: true, default: '', maxlength: 120 },
  issue: { type: String, trim: true, required: true, maxlength: 150 },
  description: { type: String, trim: true, default: '', maxlength: 3000 },
  status: { type: String, enum: ['pending', 'on-hold', 'completed'], default: 'pending' },
  visitDate: { type: String, default: null },
  completedAt: { type: Date, default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  history: [activitySchema],
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ assignedTo: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', schema);
