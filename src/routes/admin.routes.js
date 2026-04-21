const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, query } = require('express-validator');

// All admin routes require authentication and admin role
router.use(protect);
router.use(restrictTo('admin'));

// Dashboard analytics
router.get('/dashboard', adminController.getDashboardAnalytics);
router.get('/statistics', adminController.getSystemStatistics);
router.get('/analytics/overview', adminController.getDashboardAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowthAnalytics);
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/investments', adminController.getInvestmentsAnalytics);
router.get('/analytics/category-distribution', adminController.getCategoryDistribution);
router.get('/analytics/recent-activities', adminController.getRecentActivities);
router.get('/analytics/product-performance', adminController.getProductPerformance);

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);
router.post(
  '/users',
  validate([
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  ]),
  adminController.createUser
);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/kyc/approve', adminController.approveUserKYC);
router.post('/users/:id/kyc/reject', adminController.rejectUserKYC);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);
router.post('/users/bulk/suspend', adminController.bulkSuspendUsers);
router.post('/users/bulk/activate', adminController.bulkActivateUsers);
router.post('/users/bulk/delete', adminController.bulkDeleteUsers);
router.get('/users/export', adminController.exportUsers);
router.patch(
  '/users/:id/kyc',
  validate([
    body('kycStatus')
      .isIn(['pending', 'verified', 'rejected'])
      .withMessage('Invalid KYC status'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
  ]),
  adminController.updateUserKYCStatus
);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.get('/users/:id/investments', adminController.getUserInvestments);
router.get('/users/:id/transactions', adminController.getUserTransactions);
router.get('/users/:id/activities', adminController.getUserActivities);

// Withdrawal Management
router.get('/withdrawals/pending', adminController.getPendingWithdrawals);
router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);
router.post('/withdrawals/batch-approve', adminController.batchApproveWithdrawals);
router.post(
  '/withdrawals/:id/process',
  validate([
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
  ]),
  adminController.processWithdrawal
);

// Investment Management
router.get('/investments', adminController.getAllInvestments);
router.get('/investments/:id', adminController.getInvestmentDetails);
router.patch('/investments/:id/cancel', adminController.cancelInvestment);
router.patch('/investments/:id/status', adminController.updateInvestmentStatus);
router.get('/investments/export', adminController.exportInvestments);

// Transaction Management
router.get('/transactions', adminController.getAllTransactions);
router.get('/transactions/:id', adminController.getTransactionDetails);
router.get('/transactions/export', adminController.exportTransactions);

// Notification Management
const notificationController = require('../controllers/notification.controller');
router.get('/notifications', adminController.getAllNotifications);
router.post(
  '/notifications/send',
  validate([
    body('userId').notEmpty().withMessage('User ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString().withMessage('Type must be a string'),
  ]),
  notificationController.sendNotificationToUser
);
router.post(
  '/notifications/broadcast',
  validate([
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString().withMessage('Type must be a string'),
  ]),
  notificationController.broadcastNotification
);
router.put(
  '/notifications/:id',
  validate([
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString().withMessage('Type must be a string'),
  ]),
  adminController.updateNotification
);
router.delete('/notifications/:id', adminController.deleteNotification);

// Activity Logs Management
router.get('/activity-logs', adminController.getActivityLogs);
router.get('/activity-logs/export', adminController.exportActivityLogs);

module.exports = router;
