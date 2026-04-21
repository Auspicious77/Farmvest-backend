const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validation.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Register
router.post(
  '/register',
  validate([
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  ]),
  authController.register
);

// Verify email
router.post(
  '/verify-email',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ]),
  authController.verifyEmail
);

// Resend verification
router.post(
  '/resend-verification',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
  ]),
  authController.resendVerification
);

// Login
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login
);

// Admin Login (same as regular login but clearer endpoint)
router.post(
  '/admin/login',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login
);

// Forgot password
router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().withMessage('Please provide a valid email'),
  ]),
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  validate([
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  ]),
  authController.resetPassword
);

// Refresh token
router.post(
  '/refresh-token',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ]),
  authController.refreshToken
);

// Logout (protected route)
router.post('/logout', protect, authController.logout);

// Get current user (protected route)
router.get('/me', protect, authController.getMe);

module.exports = router;
