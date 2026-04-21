const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./error.middleware');
const { verifyToken } = require('../utils/jwt.util');

// Protect routes - JWT authentication
exports.protect = async (req, res, next) => {
  try {
    console.log('DEBUG: protect middleware called for:', req.path);
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('DEBUG: No token found');
      return next(new AppError('You are not logged in. Please log in to access this resource', 401));
    }

    console.log('DEBUG: Token found, verifying...');
    // Verify token
    const decoded = verifyToken(token);
    console.log('DEBUG: Token verified, user ID:', decoded.id);

    // Check if user still exists
    console.log('DEBUG: Finding user in database...');
    const user = await User.findById(decoded.id);
    console.log('DEBUG: User found:', !!user);
    
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Your account has been suspended. Please contact support', 403));
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email address to access this resource', 403));
    }

    console.log('DEBUG: User authenticated, calling next()');
    // Grant access
    req.user = user;
    next();
  } catch (error) {
    console.log('DEBUG: Error in protect middleware:', error.message);
    return next(new AppError('Invalid or expired token. Please log in again', 401));
  }
};

// Restrict to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Optional authentication (for public routes that can benefit from user context)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Verify email before access
exports.requireVerifiedEmail = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return next(new AppError('Please verify your email address to access this resource', 403));
  }
  next();
};

// Verify KYC before access
exports.requireVerifiedKYC = (req, res, next) => {
  if (req.user.kycStatus !== 'verified') {
    return next(new AppError('Please complete KYC verification to access this resource', 403));
  }
  next();
};

// Check transaction PIN
exports.requireTransactionPin = (req, res, next) => {
  if (!req.user.transactionPin) {
    return next(new AppError('Please set up a transaction PIN to perform this action', 403));
  }
  next();
};
