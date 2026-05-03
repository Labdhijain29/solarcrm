const mongoose = require('mongoose');

const inventoryActivitySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['Product Created', 'Product Updated', 'Product Deleted', 'Stock Received', 'Stock Dispatched', 'Dispatch Updated'],
    required: true,
  },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  dispatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch' },
  message: { type: String, required: true, trim: true },
  quantityChange: { type: Number, default: 0 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String, trim: true, default: '' },
}, { timestamps: true });

inventoryActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryActivity', inventoryActivitySchema);
