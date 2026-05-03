const express = require('express');
const router = express.Router();
const { bulkAddProducts, createProduct, deleteProduct, getInventoryStats, getProducts, updateProduct } = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/stats', authorize('Admin', 'Stock Manager', 'Dispatch Manager', 'Installation Manager'), getInventoryStats);
router.post('/bulk', authorize('Admin', 'Stock Manager'), bulkAddProducts);

router.route('/')
  .get(authorize('Admin', 'Stock Manager', 'Dispatch Manager', 'Installation Manager'), getProducts)
  .post(authorize('Admin', 'Stock Manager'), createProduct);

router.route('/:id')
  .put(authorize('Admin', 'Stock Manager'), updateProduct)
  .delete(authorize('Admin', 'Stock Manager'), deleteProduct);

module.exports = router;
