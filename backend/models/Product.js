const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Item name is required'], trim: true },
  sku: { type: String, trim: true, default: '', index: true },
  productCode: { type: String, trim: true, default: '', index: true },
  hsnCode: { type: String, trim: true, default: '' },
  category: { type: String, required: [true, 'Category is required'], trim: true, index: true },
  subCategory: { type: String, trim: true, default: '' },
  brand: { type: String, trim: true, default: '' },
  type: { type: String, trim: true, default: '' },
  capacity: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  price: { type: Number, required: true, min: 0, default: 0 },
  salePrice: { type: Number, min: 0, default: 0 },
  gstPercent: { type: Number, min: 0, max: 100, default: 18 },
  unit: { type: String, trim: true, default: 'pcs' },
  lowStockThreshold: { type: Number, min: 0, default: 10 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

productSchema.index({ name: 'text', sku: 'text', productCode: 'text', category: 'text', brand: 'text', type: 'text', capacity: 'text' });
productSchema.index(
  { name: 1, category: 1, brand: 1, type: 1, capacity: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

productSchema.virtual('status').get(function () {
  return this.quantity < this.lowStockThreshold ? 'Low Stock' : 'In Stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
