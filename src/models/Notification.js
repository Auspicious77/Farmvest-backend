const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  title: {
    type: String,
    required: [true, 'Please provide notification title'],
  },
  message: {
    type: String,
    required: [true, 'Please provide notification message'],
  },
  type: {
    type: String,
    enum: ['investment', 'wallet', 'kyc', 'general', 'alert', 'system', 'info'],
    default: 'general',
  },
  
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    default: null,
  },
  isPush: {
    type: Boolean,
    default: false,
  },
  
  // Additional data for deep linking
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ user: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

// Compound index
notificationSchema.index({ user: 1, isRead: 1 });

// Auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
  return this;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
