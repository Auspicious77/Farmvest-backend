const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get profile
router.get('/profile', userController.getProfile);

// Update profile
router.put(
  '/profile',
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('phone').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
    body('address').optional().trim(),
    validate,
  ],
  userController.updateProfile
);

// Upload profile picture
router.post(
  '/upload-profile-picture',
  [
    body('imageUrl').notEmpty().withMessage('Image URL is required'),
    validate,
  ],
  userController.uploadProfilePicture
);

// Verify BVN
router.post(
  '/verify-bvn',
  [
    body('bvn').isLength({ min: 11, max: 11 }).withMessage('BVN must be exactly 11 digits'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required (YYYY-MM-DD)'),
    validate,
  ],
  userController.verifyBVN
);

// Verify NIN
router.post(
  '/verify-nin',
  [
    body('nin').isLength({ min: 11, max: 11 }).withMessage('NIN must be exactly 11 digits'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    validate,
  ],
  userController.verifyNIN
);

// Change password
router.put(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('New password must contain at least one number'),
    validate,
  ],
  userController.changePassword
);

// Set transaction PIN
router.post(
  '/set-transaction-pin',
  [
    body('pin').isLength({ min: 6, max: 6 }).withMessage('PIN must be exactly 6 digits'),
    validate,
  ],
  userController.setTransactionPin
);

// Change transaction PIN
router.put(
  '/change-transaction-pin',
  [
    body('currentPin').isLength({ min: 6, max: 6 }).withMessage('Current PIN must be 6 digits'),
    body('newPin').isLength({ min: 6, max: 6 }).withMessage('New PIN must be 6 digits'),
    validate,
  ],
  userController.changeTransactionPin
);

// Verify transaction PIN
router.post(
  '/verify-transaction-pin',
  [
    body('pin').isLength({ min: 6, max: 6 }).withMessage('PIN must be 6 digits'),
    validate,
  ],
  userController.verifyTransactionPin
);

// Update primary bank account
router.put(
  '/update-primary-account',
  [
    body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('accountName').trim().notEmpty().withMessage('Account name is required'),
    body('bankCode').trim().notEmpty().withMessage('Bank code is required'),
    body('bankName').trim().notEmpty().withMessage('Bank name is required'),
    validate,
  ],
  userController.updatePrimaryAccount
);

// Register device token for push notifications
router.post(
  '/register-device-token',
  [
    body('deviceToken').notEmpty().withMessage('Device token is required'),
    validate,
  ],
  userController.registerDeviceToken
);

module.exports = router;
