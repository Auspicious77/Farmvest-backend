const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
  },
  
  type: {
    type: String,
    enum: ['funding', 'withdrawal', 'investment', 'roi_payout'],
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please provide transaction amount'],
    min: 0,
  },
  
  // Payment Details
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paystack', 'palmpay', 'wallet', null],
    default: null,
  },
  paymentProvider: {
    type: String,
    default: null,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'cancelled'],
    default: 'pending',
  },
  
  // For withdrawals
  destinationAccount: {
    accountNumber: {
      type: String,
      default: null,
    },
    accountName: {
      type: String,
      default: null,
    },
    bankName: {
      type: String,
      default: null,
    },
    bankCode: {
      type: String,
      default: null,
    },
  },
  
  // Related entities
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    default: null,
  },
  
  // Metadata
  description: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  // Admin actions (for withdrawals)
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  
  // Timestamps for tracking
  completedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
transactionSchema.index({ user: 1 });
transactionSchema.index({ wallet: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

// Compound indexes
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, status: 1 });
transactionSchema.index({ type: 1, status: 1 });

// Static method to generate unique reference
transactionSchema.statics.generateReference = function(prefix = 'TXN') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}-${timestamp}-${random}`;
};

// Mark transaction as successful
transactionSchema.methods.markAsSuccessful = async function() {
  this.status = 'successful';
  this.completedAt = new Date();
  await this.save();
  return this;
};

// Mark transaction as failed
transactionSchema.methods.markAsFailed = async function(reason = null) {
  this.status = 'failed';
  this.rejectionReason = reason;
  this.completedAt = new Date();
  await this.save();
  return this;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
