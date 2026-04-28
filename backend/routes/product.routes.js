const express = require('express');
const router = express.Router();
const { createProduct, deleteProduct, getInventoryStats, getProducts, updateProduct } = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/stats', authorize('Admin', 'Stock Manager', 'Dispatch Manager'), getInventoryStats);

router.route('/')
  .get(authorize('Admin', 'Stock Manager', 'Dispatch Manager'), getProducts)
  .post(authorize('Admin', 'Stock Manager'), createProduct);

router.route('/:id')
  .put(authorize('Admin', 'Stock Manager'), updateProduct)
  .delete(authorize('Admin', 'Stock Manager'), deleteProduct);

module.exports = router;
