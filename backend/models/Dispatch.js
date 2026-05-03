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
  price: { type: Number, min: 0, default: 0 },
  lineTotal: { type: Number, min: 0, default: 0 },
  remainingQuantity: { type: Number, min: 0, default: 0 },
}, { _id: false });

const dispatchSchema = new mongoose.Schema({
  billNo: { type: String, trim: true, default: '', index: true },
  customerName: { type: String, required: [true, 'Customer name is required'], trim: true },
  leadId: { type: String, trim: true, default: '', index: true },
  engineerName: { type: String, required: [true, 'Installation engineer name is required'], trim: true },
  siteAddress: { type: String, required: [true, 'Site address is required'], trim: true },
  mobile: { type: String, required: [true, 'Mobile number is required'], trim: true },
  items: { type: [dispatchItemSchema], validate: v => Array.isArray(v) && v.length > 0 },
  subTotal: { type: Number, min: 0, default: 0 },
  grandTotal: { type: Number, min: 0, default: 0 },
  approvalStatus: { type: String, enum: ['Pending', 'Approved'], default: 'Pending', index: true },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedByName: { type: String, trim: true, default: '' },
  billLocked: { type: Boolean, default: false },
  installationStatus: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending', index: true },
  installationUpdatedAt: { type: Date, default: null },
  installationUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  installationUpdatedByName: { type: String, trim: true, default: '' },
  dispatchDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, trim: true, default: '' },
}, { timestamps: true });

dispatchSchema.index({ customerName: 'text', leadId: 'text', engineerName: 'text', mobile: 'text' });

module.exports = mongoose.model('Dispatch', dispatchSchema);
