const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  order: { type:Number, min:1, validate:{ validator:Number.isSafeInteger, message:'Office order must be a whole number starting from 1.' }, index:true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true, match: [/^[A-Z0-9_-]{2,12}$/, 'Office code must contain 2–12 letters, digits, hyphens or underscores.'] },
  address: { type: String, trim: true, default: '', maxlength: 500 },
  state: { type: String, trim: true, default: '', maxlength: 100 },
  city: { type: String, trim: true, default: '', maxlength: 100 },
  pincode: { type: String, default: '', match: [/^(\d{6})?$/, 'Enter a 6-digit pincode.'] },
  phone: { type: String, default: '', match: [/^(\d{10})?$/, 'Enter a 10-digit contact number.'] },
  email: { type: String, trim: true, lowercase: true, default: '', match: [/^(\S+@\S+\.\S+)?$/, 'Enter a valid email address.'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model('Office', schema);
