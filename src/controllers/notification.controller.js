const Notification = require('../models/Notification');
const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

// Get user notifications
exports.getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;

    const query = { user: req.user._id };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification
exports.deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get notification preferences
exports.getNotificationPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');

    res.status(200).json({
      success: true,
      data: {
        preferences: user.notificationPreferences || {
          email: true,
          push: true,
          sms: false,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update notification preferences
exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const { email, push, sms } = req.body;

    const user = await User.findById(req.user._id);

    user.notificationPreferences = {
      email: email !== undefined ? email : user.notificationPreferences?.email || true,
      push: push !== undefined ? push : user.notificationPreferences?.push || true,
      sms: sms !== undefined ? sms : user.notificationPreferences?.sms || false,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      data: {
        preferences: user.notificationPreferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Send notification to specific user
exports.sendNotificationToUser = async (req, res, next) => {
  try {
    const { userId, title, message, type } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const notification = await Notification.create({
      user: userId,
      type: type || 'general',
      title,
      message,
      data: {
        sentBy: req.user._id,
        sentByName: req.user.fullName || req.user.email,
      },
    });

    // TODO: Send push notification via FCM

    logger.info(`Notification sent to user ${user.email} by admin ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Broadcast notification to all users
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type, userFilter } = req.body;

    let query = {};

    // Apply user filters
    if (userFilter) {
      if (userFilter.kycStatus) {
        query.kycStatus = userFilter.kycStatus;
      }
      if (userFilter.walletTier) {
        query.walletTier = userFilter.walletTier;
      }
    }

    const users = await User.find(query).select('_id email fullName');

    const notifications = users.map((user) => ({
      user: user._id,
      type: type || 'general',
      title,
      message,
      data: {
        broadcast: true,
        sentBy: req.user._id,
        sentByName: req.user.fullName || req.user.email,
      },
    }));

    await Notification.insertMany(notifications);

    // TODO: Send push notifications via FCM in batches

    logger.info(
      `Broadcast notification sent to ${users.length} users by admin ${req.user.email}`
    );

    res.status(201).json({
      success: true,
      message: `Notification broadcast to ${users.length} users`,
      data: {
        recipientCount: users.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to create notification (for use in other controllers)
exports.createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type: type || 'general',
      title,
      message,
      data,
    });

    // TODO: Send push notification via FCM if user has it enabled

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};
