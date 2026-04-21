const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  
  reason: {
    type: String,
    required: true,
    enum: ['trending', 'high_roi', 'user_activity', 'admin_highlight', 'new_product'],
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  
  isDisplayed: {
    type: Boolean,
    default: false,
  },
  isActedUpon: {
    type: Boolean,
    default: false,
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },
}, {
  timestamps: true,
});

// Indexes
recommendationSchema.index({ user: 1 });
recommendationSchema.index({ product: 1 });
recommendationSchema.index({ score: -1 });
recommendationSchema.index({ expiresAt: 1 });

// Compound index
recommendationSchema.index({ user: 1, isActedUpon: 1 });

// Auto-delete expired recommendations
recommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

module.exports = Recommendation;
