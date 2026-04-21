const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Virtual Account for Bank Transfers
  virtualAccount: {
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
    provider: {
      type: String,
      enum: ['monnify', 'flutterwave', null],
      default: null,
    },
  },
  
  // Bank Accounts (for withdrawals)
  bankAccounts: [{
    accountNumber: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    bankCode: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Statistics
  totalFunded: {
    type: Number,
    default: 0,
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
  },
  totalInvested: {
    type: Number,
    default: 0,
  },
  totalReturns: {
    type: Number,
    default: 0,
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
walletSchema.index({ user: 1 });

// Methods
walletSchema.methods.credit = async function(amount, type = 'funding') {
  this.balance += amount;
  
  if (type === 'funding') {
    this.totalFunded += amount;
  } else if (type === 'return') {
    this.totalReturns += amount;
  }
  
  await this.save();
  return this;
};

walletSchema.methods.debit = async function(amount, type = 'investment') {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  this.balance -= amount;
  
  if (type === 'investment') {
    this.totalInvested += amount;
  } else if (type === 'withdrawal') {
    this.totalWithdrawn += amount;
  }
  
  await this.save();
  return this;
};

// Check if user has sufficient balance
walletSchema.methods.hasSufficientBalance = function(amount) {
  return this.balance >= amount;
};

// Get wallet tier limit
walletSchema.methods.getTransactionLimit = async function() {
  const user = await mongoose.model('User').findById(this.user);
  
  if (user.walletTier === 'verified') {
    return 10000000; // 10M for verified users
  }
  
  return 100000; // 100K for basic users
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
