const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const recommendationService = require('../services/recommendation.service');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, query } = require('express-validator');

// Public routes
router.get('/', productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/performance', productController.getProductPerformance);

// Protected user routes
router.get('/recommendations/me', protect, async (req, res, next) => {
  try {
    const recommendations = await recommendationService.getUserRecommendations(req.user._id);
    res.status(200).json({
      success: true,
      data: { recommendations },
    });
  } catch (error) {
    next(error);
  }
});

// Admin only routes
router.use(protect, restrictTo('admin'));

// Upload product image
router.post('/upload-image', productController.uploadProductImage);

router.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Product name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category')
      .isIn(['liquid', 'solid', 'livestock', 'poultry'])
      .withMessage('Invalid category'),
    body('unitType')
      .isIn(['gallon', 'bag', 'unit'])
      .withMessage('Invalid unit type'),
    body('unitPrice')
      .isNumeric()
      .custom((value) => value >= 100)
      .withMessage('Unit price must be at least ₦100'),
    body('minQuantity')
      .isInt({ min: 1 })
      .withMessage('Minimum quantity must be at least 1'),
    body('maxQuantity')
      .isInt({ min: 1 })
      .withMessage('Maximum quantity must be at least 1'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
    body('maxInvestors').isInt({ min: 1 }).withMessage('Maximum investors must be at least 1'),
    body('roiRange.min')
      .isNumeric()
      .custom((value) => value >= 0)
      .withMessage('Minimum ROI must be 0 or greater'),
    body('roiRange.max').isNumeric().withMessage('Maximum ROI must be a number'),
  ]),
  productController.createProduct
);

router.patch(
  '/:id',
  validate([
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('category')
      .optional()
      .isIn(['liquid', 'solid', 'livestock', 'poultry'])
      .withMessage('Invalid category'),
    body('unitType')
      .optional()
      .isIn(['gallon', 'bag', 'unit'])
      .withMessage('Invalid unit type'),
    body('unitPrice')
      .optional()
      .isNumeric()
      .custom((value) => value >= 100)
      .withMessage('Unit price must be at least ₦100'),
    body('minQuantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Minimum quantity must be at least 1'),
    body('maxQuantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Maximum quantity must be at least 1'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
  ]),
  productController.updateProduct
);

router.post(
  '/:id/performance',
  validate([
    body('price').isNumeric().withMessage('Price must be a number'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
  ]),
  productController.updateProductPerformance
);

router.put('/:id', productController.updateProduct);
router.patch('/:id/status', productController.updateProductStatus);
router.patch('/:id/toggle-status', productController.toggleProductStatus);
router.delete('/:id', productController.deleteProduct);
router.delete('/:id/performance/:performanceId', productController.deleteProductPerformance);
router.get('/:id/statistics', productController.getProductStatistics);
router.get('/:id/investors', productController.getProductInvestors);

// Bulk operations
router.post('/bulk/activate', productController.bulkActivateProducts);
router.post('/bulk/deactivate', productController.bulkDeactivateProducts);
router.post('/bulk/delete', productController.bulkDeleteProducts);

// Revenue statistics
router.get('/revenue/statistics', productController.getRevenueStatistics);

// Export
router.get('/export', productController.exportProducts);

module.exports = router;
