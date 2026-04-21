const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, query } = require('express-validator');

// All routes require authentication
router.use(protect);

// Get wallet
router.get('/', walletController.getWallet);

// Fund wallet
router.get(
  '/fund/bank-transfer',
  walletController.fundViaBankTransfer
);

router.post(
  '/fund/paystack',
  validate([
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom((value) => value >= 100)
      .withMessage('Minimum funding amount is ₦100'),
  ]),
  walletController.fundViaPaystack
);

router.post(
  '/verify-payment',
  validate([
    body('reference')
      .notEmpty()
      .withMessage('Payment reference is required'),
  ]),
  walletController.verifyPayment
);

router.post(
  '/fund/palmpay',
  validate([
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom((value) => value >= 100)
      .withMessage('Minimum funding amount is ₦100'),
  ]),
  walletController.fundViaPalmPay
);

// Withdraw
router.post(
  '/withdraw',
  validate([
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom((value) => value >= 100)
      .withMessage('Minimum withdrawal amount is ₦100'),
    body('pin')
      .isLength({ min: 6, max: 6 })
      .withMessage('Transaction PIN must be 6 digits')
      .isNumeric()
      .withMessage('Transaction PIN must contain only numbers'),
  ]),
  walletController.withdraw
);

// Get transactions
router.get(
  '/transactions',
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('type')
      .optional()
      .isIn(['funding', 'withdrawal', 'investment', 'roi_payout'])
      .withMessage('Invalid transaction type'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed'])
      .withMessage('Invalid status'),
  ]),
  walletController.getTransactions
);

// Get transaction by ID
router.get('/transactions/:id', walletController.getTransactionById);

// Bank account management
router.get('/banks', walletController.getBankAccounts);

router.post(
  '/banks',
  validate([
    body('bankCode').notEmpty().withMessage('Bank code is required'),
    body('accountNumber')
      .notEmpty()
      .withMessage('Account number is required')
      .isLength({ min: 10, max: 10 })
      .withMessage('Account number must be 10 digits'),
  ]),
  walletController.addBankAccount
);

router.put('/banks/:bankId/primary', walletController.setPrimaryBankAccount);

router.delete('/banks/:bankId', walletController.deleteBankAccount);

// Bank utilities
router.get('/banks-list', walletController.getBanksList);

router.get(
  '/resolve-account',
  validate([
    query('accountNumber')
      .notEmpty()
      .withMessage('Account number is required')
      .isLength({ min: 10, max: 10 })
      .withMessage('Account number must be 10 digits'),
    query('bankCode')
      .notEmpty()
      .withMessage('Bank code is required'),
  ]),
  walletController.resolveAccountNumber
);

module.exports = router;
