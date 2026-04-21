const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  adminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'approve', 'reject', 'suspend', 'activate', 'login', 'logout', 'export', 'view'],
    required: true,
  },
  resource: {
    type: String,
    enum: ['user', 'product', 'investment', 'withdrawal', 'transaction', 'admin', 'notification', 'settings', 'report'],
    required: true,
  },
  resourceId: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  details: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success',
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
activityLogSchema.index({ adminUser: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resource: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ ipAddress: 1 });

// Compound indexes
activityLogSchema.index({ adminUser: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, resource: 1 });

// Auto-delete old logs after 90 days (optional)
// activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
