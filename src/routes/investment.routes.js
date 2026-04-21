const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investment.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, query } = require('express-validator');

// Protected user routes
router.use(protect);

// User investment routes
router.get('/', investmentController.getMyInvestments);
router.get('/summary', investmentController.getInvestmentSummary);
router.get('/:id', investmentController.getInvestmentById);
router.get('/:id/performance', investmentController.getInvestmentPerformance);

router.post(
  '/',
  validate([
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity')
      .isNumeric()
      .withMessage('Quantity must be a number')
      .custom((value) => value >= 1)
      .withMessage('Minimum quantity is 1'),
    body('duration')
      .optional()
      .isNumeric()
      .withMessage('Duration must be a number'),
    body('pin')
      .isLength({ min: 6, max: 6 })
      .withMessage('Transaction PIN must be 6 digits')
      .isNumeric()
      .withMessage('Transaction PIN must contain only numbers'),
  ]),
  investmentController.createInvestment
);

router.post(
  '/:id/withdraw',
  validate([
    body('pin')
      .isLength({ min: 6, max: 6 })
      .withMessage('Transaction PIN must be 6 digits')
      .isNumeric()
      .withMessage('Transaction PIN must contain only numbers'),
  ]),
  investmentController.withdrawInvestment
);

// Admin routes
router.use(restrictTo('admin'));

router.get('/admin/all', investmentController.getAllInvestments);
router.post('/admin/:id/complete', investmentController.completeInvestment);
router.post('/admin/auto-complete', investmentController.autoCompleteMaturedInvestments);

module.exports = router;
