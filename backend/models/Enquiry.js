const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Durable reservation: retries resume the same lead; edits/deletes cannot race conversion.
  pendingConversion: { type: mongoose.Schema.Types.Mixed, select: false },
  name:        { type: String, required: true, trim: true },
  contact:     { type: String, required: true, trim: true },
  phone:       { type: String, trim: true, default: '' },
  email:       { type: String, trim: true, lowercase: true, default: '' },
  address:     { type: String, trim: true, default: '' },
  enquiryType: { type: String, required: true, trim: true },
  state:       { type: String, trim: true, default: '' },
  city:        { type: String, trim: true, default: '' },
  pincode:     { type: String, trim: true, default: '' },
  source:      { type: String, default: 'Website' },
  status:      { type: String, enum: ['new', 'contacted', 'converted', 'closed'], default: 'new' },
  convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:       { type: String, default: '' },
  nextFollowUpDate: { type: String, default: null }, // YYYY-MM-DD in India; the latest saved entry wins.
  followUps: [{
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    dueDate: { type: String, default: null },
    completed: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

enquirySchema.index({ nextFollowUpDate: 1, status: 1, convertedTo: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
