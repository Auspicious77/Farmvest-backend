const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Revenue details
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  previousPrice: {
    type: Number,
    required: true,
  },
  newPrice: {
    type: Number,
    required: true,
  },
  priceChangePercent: {
    type: Number,
    required: true,
  },
  
  // Investment details at time of revenue generation
  investmentQuantity: {
    type: Number,
    required: true,
  },
  investmentBasePrice: {
    type: Number,
    required: true,
  },
  grossROI: {
    type: Number,
    required: true,
  },
  
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  
  notes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Indexes
revenueSchema.index({ product: 1 });
revenueSchema.index({ investment: 1 });
revenueSchema.index({ user: 1 });
revenueSchema.index({ date: -1 });
revenueSchema.index({ createdAt: -1 });

// Compound indexes
revenueSchema.index({ product: 1, date: -1 });
revenueSchema.index({ date: -1, amount: -1 });

const Revenue = mongoose.model('Revenue', revenueSchema);

module.exports = Revenue;
