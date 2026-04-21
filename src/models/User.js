const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please provide your full name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Please provide your phone number'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  address: {
    type: String,
    default: null,
  },
  
  // KYC
  bvn: {
    type: String,
    default: null,
    select: false, // Encrypted, don't return by default
  },
  nin: {
    type: String,
    default: null,
    select: false, // Encrypted, don't return by default
  },
  kycStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified',
  },
  kycRejectionReason: {
    type: String,
    default: null,
  },
  walletTier: {
    type: String,
    enum: ['basic', 'verified'],
    default: 'basic',
  },
  
  // Security
  transactionPin: {
    type: String,
    default: null,
    select: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    default: null,
    select: false,
  },
  biometricEnabled: {
    type: Boolean,
    default: false,
  },
  
  // Status
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  suspensionReason: {
    type: String,
    default: null,
  },
  
  // Password reset
  passwordResetToken: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  
  // Metadata
  lastLogin: {
    type: Date,
    default: null,
  },
  deviceTokens: [{
    type: String, // Push notification tokens
  }],
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin', 'investment_manager', 'support'],
    default: 'user',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual field for status (backwards compatibility with frontend)
userSchema.virtual('status').get(function() {
  return this.isActive ? 'active' : 'suspended';
});

// Virtual field for transactionPinSet
userSchema.virtual('transactionPinSet').get(function() {
  return !!this.transactionPin;
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ walletTier: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Hash transaction PIN before saving
userSchema.pre('save', async function(next) {
  console.log('DEBUG: transactionPin pre-save hook called');
  console.log('DEBUG: isModified(transactionPin):', this.isModified('transactionPin'));
  
  if (!this.isModified('transactionPin')) return next();
  
  console.log('DEBUG: transactionPin value before hash:', this.transactionPin);
  if (this.transactionPin) {
    this.transactionPin = await bcrypt.hash(this.transactionPin, 12);
    console.log('DEBUG: transactionPin hashed successfully');
  }
  console.log('DEBUG: transactionPin pre-save hook completing');
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Compare transaction PIN method
userSchema.methods.compareTransactionPin = async function(candidatePin) {
  if (!this.transactionPin) return false;
  return await bcrypt.compare(candidatePin, this.transactionPin);
};

// Update wallet tier based on KYC status
userSchema.methods.updateWalletTier = function() {
  if (this.kycStatus === 'verified') {
    this.walletTier = 'verified';
  } else {
    this.walletTier = 'basic';
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
