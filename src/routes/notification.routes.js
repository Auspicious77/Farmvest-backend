const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body } = require('express-validator');

// User routes
router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

router.get('/preferences', notificationController.getNotificationPreferences);
router.patch(
  '/preferences',
  validate([
    body('email').optional().isBoolean().withMessage('Email preference must be boolean'),
    body('push').optional().isBoolean().withMessage('Push preference must be boolean'),
    body('sms').optional().isBoolean().withMessage('SMS preference must be boolean'),
  ]),
  notificationController.updateNotificationPreferences
);

// Admin routes
router.use(restrictTo('admin'));

router.post(
  '/send-to-user',
  validate([
    body('userId').notEmpty().withMessage('User ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString().withMessage('Type must be a string'),
  ]),
  notificationController.sendNotificationToUser
);

router.post(
  '/broadcast',
  validate([
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString().withMessage('Type must be a string'),
  ]),
  notificationController.broadcastNotification
);

module.exports = router;
