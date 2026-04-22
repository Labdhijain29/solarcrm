const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
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
}, { timestamps: true });

module.exports = mongoose.model('Enquiry', enquirySchema);
