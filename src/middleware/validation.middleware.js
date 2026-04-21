const { validationResult } = require('express-validator');
const { AppError } = require('./error.middleware');

// Validate request - can be used as middleware directly or as a factory
exports.validate = (req, res, next) => {
  // If called with an array (factory pattern), return middleware
  if (Array.isArray(req)) {
    const validations = req;
    return async (req, res, next) => {
      console.log('DEBUG: validate middleware called (factory pattern)');
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        console.log('DEBUG: Validation errors found:', errors.array());
        const errorMessages = errors.array().map(err => ({
          field: err.param || err.path,
          message: err.msg,
        }));
        
        return next(new AppError(JSON.stringify(errorMessages), 400));
      }
      
      console.log('DEBUG: Validation passed, calling next()');
      next();
    };
  }
  
  // Used as direct middleware (checking already-run validations)
  console.log('DEBUG: validate middleware called (direct pattern)');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log('DEBUG: Validation errors found:', errors.array());
    const errorMessages = errors.array().map(err => ({
      field: err.param || err.path,
      message: err.msg,
    }));
    
    return next(new AppError(JSON.stringify(errorMessages), 400));
  }
  
  console.log('DEBUG: Validation passed, calling next()');
  next();
};

// Custom validation functions
exports.validateAmount = (amount, min = 0, max = Infinity) => {
  if (isNaN(amount) || amount < min || amount > max) {
    throw new Error(`Amount must be between ${min} and ${max}`);
  }
  return true;
};

exports.validateEmail = (email) => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Please provide a valid email address');
  }
  return true;
};

exports.validatePassword = (password) => {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number');
  }
  return true;
};

exports.validateTransactionPin = (pin) => {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Transaction PIN must be exactly 6 digits');
  }
  return true;
};

exports.validateBVN = (bvn) => {
  if (!/^\d{11}$/.test(bvn)) {
    throw new Error('BVN must be exactly 11 digits');
  }
  return true;
};

exports.validateNIN = (nin) => {
  if (!/^\d{11}$/.test(nin)) {
    throw new Error('NIN must be exactly 11 digits');
  }
  return true;
};
