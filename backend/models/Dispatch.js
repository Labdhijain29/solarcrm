const mongoose = require('mongoose');

const dispatchItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true, trim: true },
  category: { type: String, trim: true, default: '' },
  brand: { type: String, trim: true, default: '' },
  type: { type: String, trim: true, default: '' },
  capacity: { type: String, trim: true, default: '' },
  unit: { type: String, trim: true, default: 'pcs' },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const dispatchSchema = new mongoose.Schema({
  customerName: { type: String, required: [true, 'Customer name is required'], trim: true },
  leadId: { type: String, trim: true, default: '', index: true },
  engineerName: { type: String, required: [true, 'Installation engineer name is required'], trim: true },
  siteAddress: { type: String, required: [true, 'Site address is required'], trim: true },
  mobile: { type: String, required: [true, 'Mobile number is required'], trim: true },
  items: { type: [dispatchItemSchema], validate: v => Array.isArray(v) && v.length > 0 },
  dispatchDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, trim: true, default: '' },
}, { timestamps: true });

dispatchSchema.index({ customerName: 'text', leadId: 'text', engineerName: 'text', mobile: 'text' });

module.exports = mongoose.model('Dispatch', dispatchSchema);
