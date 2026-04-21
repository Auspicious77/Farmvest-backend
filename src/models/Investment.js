const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
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
  
  // Quantity-based investment
  quantity: {
    type: Number,
    required: [true, 'Please provide investment quantity'],
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: 0,
  },
  currentUnitPrice: {
    type: Number,
    default: 0,
  },
  totalInvestment: {
    type: Number,
    required: true,
    min: 0,
  },
  currentValue: {
    type: Number,
    default: 0,
  },
  roiPercentage: {
    type: Number,
    default: 0,
  },
  roiEarned: {
    type: Number,
    default: 0,
  },
  platformFee: {
    type: Number,
    default: 0, // 20% of ROI goes to platform
  },
  netRoiEarned: {
    type: Number,
    default: 0, // ROI after platform fee (80% of total ROI)
  },
  
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in days
    required: true,
  },
  
  status: {
    type: String,
    enum: ['active', 'completed', 'withdrawn'],
    default: 'active',
  },
  completedAt: {
    type: Date,
    default: null,
  },
  
  // Performance tracking (price snapshots for candlestick charts)
  priceSnapshots: [{
    date: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    percentageChange: {
      type: Number,
      default: 0,
    },
  }],
  
  // Transaction reference
  transactionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
investmentSchema.index({ user: 1 });
investmentSchema.index({ product: 1 });
investmentSchema.index({ status: 1 });
investmentSchema.index({ startDate: -1 });
investmentSchema.index({ endDate: 1 });
investmentSchema.index({ createdAt: -1 });

// Compound indexes
investmentSchema.index({ user: 1, status: 1 });
investmentSchema.index({ product: 1, status: 1 });

// Calculate current value and ROI with platform fee (20% to admin, 80% to investor)
investmentSchema.methods.calculateCurrentValue = function() {
  // Calculate gross current value
  const grossCurrentValue = this.quantity * this.currentUnitPrice;
  
  // Calculate gross ROI
  const grossROI = grossCurrentValue - this.totalInvestment;
  
  // Platform takes 20% of the ROI (not the total value)
  this.platformFee = grossROI > 0 ? grossROI * 0.20 : 0;
  
  // Investor gets 80% of the ROI
  this.netRoiEarned = grossROI > 0 ? grossROI * 0.80 : grossROI;
  
  // Current value = initial investment + net ROI (80%)
  this.currentValue = this.totalInvestment + this.netRoiEarned;
  
  return this.currentValue;
};

investmentSchema.methods.calculateROI = function() {
  if (this.unitPrice === 0) return 0;
  
  // Calculate actual price change percentage
  const actualPriceChangePercent = ((this.currentUnitPrice - this.unitPrice) / this.unitPrice) * 100;
  
  // Investor sees 80% of the ROI percentage
  this.roiPercentage = actualPriceChangePercent * 0.80;
  
  // Total ROI earned (already calculated in calculateCurrentValue)
  this.roiEarned = this.currentValue - this.totalInvestment;
  
  return this.roiPercentage;
};

// Check if investment is withdrawable
investmentSchema.methods.isWithdrawable = function() {
  return new Date() >= this.endDate && this.status === 'active';
};

// Check if investment is matured
investmentSchema.methods.isMatured = function() {
  return new Date() >= this.endDate;
};

// Calculate days remaining
investmentSchema.methods.daysRemaining = function() {
  const now = new Date();
  const diff = this.endDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const Investment = mongoose.model('Investment', investmentSchema);

module.exports = Investment;
