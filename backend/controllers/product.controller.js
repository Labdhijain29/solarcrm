const Product = require('../models/Product');
const Dispatch = require('../models/Dispatch');
const InventoryActivity = require('../models/InventoryActivity');
const User = require('../models/User');

const recordActivity = (payload) => InventoryActivity.create(payload).catch(console.error);
const notifyDispatchManagers = (message) => User.updateMany(
  { role: 'Dispatch Manager', isActive: true },
  { $push: { notifications: { message } } }
).catch(console.error);

const buildProductQuery = (query = {}) => {
  const q = {};
  if (query.category) q.category = query.category;
  if (query.subCategory) q.subCategory = query.subCategory;
  if (query.brand) q.brand = new RegExp(query.brand, 'i');
  if (query.lowStock === 'true') q.$expr = { $lt: ['$quantity', '$lowStockThreshold'] };
  if (query.search) {
    q.$or = [
      { name: new RegExp(query.search, 'i') },
      { sku: new RegExp(query.search, 'i') },
      { productCode: new RegExp(query.search, 'i') },
      { category: new RegExp(query.search, 'i') },
      { subCategory: new RegExp(query.search, 'i') },
      { brand: new RegExp(query.search, 'i') },
      { type: new RegExp(query.search, 'i') },
      { capacity: new RegExp(query.search, 'i') },
    ];
  }
  return q;
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find(buildProductQuery(req.query)).sort({ category: 1, name: 1 });
    const totalQuantity = products.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const lowStockCount = products.filter(item => Number(item.quantity || 0) < Number(item.lowStockThreshold || 10)).length;

    res.json({
      success: true,
      data: products,
      summary: {
        totalItems: products.length,
        totalQuantity,
        lowStockCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      quantity: Number(req.body.quantity || 0),
      price: Number(req.body.price || 0),
      salePrice: Number(req.body.salePrice || req.body.price || 0),
      gstPercent: Number(req.body.gstPercent ?? 18),
      lowStockThreshold: Number(req.body.lowStockThreshold || 10),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await recordActivity({
      action: 'Product Created',
      product: product._id,
      message: `${product.name} added with ${product.quantity} ${product.unit}`,
      quantityChange: product.quantity,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });
    await notifyDispatchManagers(`New stock added: ${product.name} | ${product.quantity} ${product.unit} available`);

    res.status(201).json({ success: true, message: 'Product added', data: product });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This inventory item already exists. Update quantity instead.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.bulkAddProducts = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Add at least one stock item.' });
    }

    const receiptNo = String(req.body.receiptNo || '').trim() || `STK-${Date.now()}`;
    const savedItems = [];

    for (const raw of items) {
      const quantity = Number(raw.quantity || 0);
      if (quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each stock item needs quantity greater than 0.' });
      }

      const payload = {
        name: String(raw.name || [raw.brand, raw.type, raw.capacity].filter(Boolean).join(' ') || raw.category || 'Stock Item').trim(),
        sku: String(raw.sku || raw.productCode || '').trim(),
        productCode: String(raw.productCode || raw.sku || '').trim(),
        hsnCode: String(raw.hsnCode || '').trim(),
        category: String(raw.category || '').trim(),
        subCategory: String(raw.subCategory || '').trim(),
        brand: String(raw.brand || '').trim(),
        type: String(raw.type || '').trim(),
        capacity: String(raw.capacity || '').trim(),
        unit: String(raw.unit || 'pcs').trim(),
        price: Number(raw.price || 0),
        salePrice: Number(raw.salePrice || raw.price || 0),
        gstPercent: Number(raw.gstPercent ?? 18),
        lowStockThreshold: Number(raw.lowStockThreshold || 10),
      };

      if (!payload.category) {
        return res.status(400).json({ success: false, message: 'Every stock item needs a category.' });
      }

      let product = await Product.findOne({
        name: payload.name,
        category: payload.category,
        brand: payload.brand,
        type: payload.type,
        capacity: payload.capacity,
      }).collation({ locale: 'en', strength: 2 });

      const beforeQuantity = Number(product?.quantity || 0);
      if (product) {
        product.quantity = beforeQuantity + quantity;
        product.unit = payload.unit;
        product.price = payload.price;
        product.salePrice = payload.salePrice;
        product.gstPercent = payload.gstPercent;
        product.sku = payload.sku || product.sku;
        product.productCode = payload.productCode || product.productCode;
        product.hsnCode = payload.hsnCode || product.hsnCode;
        product.lowStockThreshold = payload.lowStockThreshold;
        product.updatedBy = req.user._id;
        await product.save();
      } else {
        product = await Product.create({
          ...payload,
          quantity,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
      }

      savedItems.push({
        productId: product._id,
        name: product.name,
        category: product.category,
        brand: product.brand,
        type: product.type,
        capacity: product.capacity,
        unit: product.unit,
        price: product.price,
        addedQuantity: quantity,
        previousQuantity: beforeQuantity,
        currentQuantity: Number(product.quantity || 0),
      });
    }

    const totalAdded = savedItems.reduce((sum, item) => sum + item.addedQuantity, 0);
    await recordActivity({
      action: 'Stock Received',
      message: `Receipt ${receiptNo}: ${savedItems.length} items received, ${totalAdded} total quantity added`,
      quantityChange: totalAdded,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });
    await notifyDispatchManagers(`Stock receipt ${receiptNo} added: ${savedItems.length} materials updated`);

    res.status(201).json({
      success: true,
      message: 'Stock receipt saved',
      data: {
        receiptNo,
        receivedBy: req.user.name,
        receivedAt: new Date(),
        items: savedItems,
        totalAdded,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const previousQuantity = product.quantity;
    const allowed = ['name', 'sku', 'productCode', 'hsnCode', 'category', 'subCategory', 'brand', 'type', 'capacity', 'quantity', 'price', 'salePrice', 'gstPercent', 'unit', 'lowStockThreshold'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });
    product.quantity = Number(product.quantity || 0);
    product.price = Number(product.price || 0);
    product.salePrice = Number(product.salePrice || product.price || 0);
    product.gstPercent = Number(product.gstPercent ?? 18);
    product.lowStockThreshold = Number(product.lowStockThreshold || 10);
    product.updatedBy = req.user._id;
    await product.save();

    await recordActivity({
      action: 'Product Updated',
      product: product._id,
      message: `${product.name} updated`,
      quantityChange: product.quantity - previousQuantity,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });
    await notifyDispatchManagers(`Stock updated: ${product.name} | ${product.quantity} ${product.unit} available`);

    res.json({ success: true, message: 'Product updated', data: product });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Another inventory item already uses this combination.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const usedInDispatch = await Dispatch.exists({ 'items.productId': req.params.id });
    if (usedInDispatch) {
      return res.status(409).json({ success: false, message: 'This item has dispatch history. Keep it for audit and set quantity to 0 instead.' });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await recordActivity({
      action: 'Product Deleted',
      product: product._id,
      message: `${product.name} deleted`,
      quantityChange: -product.quantity,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInventoryStats = async (req, res) => {
  try {
    const [products, dispatches, activity] = await Promise.all([
      Product.find().sort({ category: 1, name: 1 }),
      Dispatch.find().sort({ dispatchDate: -1 }).limit(200),
      InventoryActivity.find().sort({ createdAt: -1 }).limit(20),
    ]);

    const categoryMap = {};
    products.forEach((product) => {
      categoryMap[product.category] = (categoryMap[product.category] || 0) + Number(product.quantity || 0);
    });

    const dispatchedByCategory = {};
    dispatches.forEach((dispatch) => {
      dispatch.items.forEach((item) => {
        dispatchedByCategory[item.category] = (dispatchedByCategory[item.category] || 0) + Number(item.quantity || 0);
      });
    });

    res.json({
      success: true,
      data: {
        totalItems: products.length,
        totalQuantity: products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        lowStockCount: products.filter(item => Number(item.quantity || 0) < Number(item.lowStockThreshold || 10)).length,
        totalDispatched: dispatches.reduce((sum, dispatch) => sum + dispatch.items.reduce((inner, item) => inner + Number(item.quantity || 0), 0), 0),
        categoryStock: Object.entries(categoryMap).map(([name, quantity]) => ({ name, quantity })),
        categoryDispatch: Object.entries(dispatchedByCategory).map(([name, quantity]) => ({ name, quantity })),
        lowStockItems: products.filter(item => Number(item.quantity || 0) < Number(item.lowStockThreshold || 10)).slice(0, 10),
        recentDispatches: dispatches.slice(0, 10),
        activity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
