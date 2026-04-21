const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { AppError } = require('../middleware/error.middleware');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { generateOTP, hashData } = require('../utils/encryption.util');
const { sanitizeUser, addDays } = require('../utils/helpers.util');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// Register user
// exports.register = async (req, res, next) => {
//   logger.info('Registering new user:', req.body);
//   try {
//     const { fullName, email, phone, password } = req.body;

//     // Check if user exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return next(new AppError('User with this email already exists', 400));
//     }

//     // Generate OTP
//     const otp = generateOTP(6);
//     const hashedOTP = hashData(otp);
//     const expirationDate = addDays(new Date(), 1); // 1 day

//     logger.info('Generated OTP for registration:', {
//       email,
//       otp,
//       hashedOTP,
//       expirationDate,
//     });

//     // Create user
//     const user = await User.create({
//       fullName,
//       email,
//       phone,
//       password,
//       emailVerificationToken: hashedOTP,
//       emailVerificationExpires: expirationDate,
//     });

//     // Create wallet for user
//     await Wallet.create({ user: user._id });

//     // Send verification email asynchronously (don't block registration)
//     // NOTE: do NOT await this call; if SMTP is slow/unreachable it should not block registration response
//     emailService.sendVerificationEmail(user, otp)
//       .then(() => logger.info('Verification email sent'))
//       .catch((emailError) => logger.error('Failed to send verification email:', emailError));

//     res.status(201).json({
//       success: true,
//       message: 'Registration successful. Please check your email for verification code',
//       data: {
//         userId: user._id,
//         email: user.email,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// Register user
exports.register = async (req, res, next) => {
  logger.info('Registering new user:', req.body);
  try {
    const { fullName, email, phone, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    // Generate OTP
    const otp = generateOTP(6);
    const hashedOTP = hashData(otp);
    const expirationDate = addDays(new Date(), 1); // 1 day

    logger.info('Generated OTP for registration:', {
      email,
      otp,
      hashedOTP,
      expirationDate,
    });

    // Create user
    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      emailVerificationToken: hashedOTP,
      emailVerificationExpires: expirationDate,
    });

    // Create wallet for user
    await Wallet.create({ user: user._id });

    // Send verification email asynchronously (don't block registration)
    // Use setImmediate to ensure response is sent first
    setImmediate(() => {
      emailService.sendVerificationEmail(user, otp)
        .then(() => logger.info('Verification email sent'))
        .catch((emailError) => logger.error('Failed to send verification email:', emailError));
    });

    // Send response immediately
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification code',
      data: {
        userId: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

// Verify email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.isEmailVerified) {
      return next(new AppError('Email already verified', 400));
    }

    // Log for debugging
    logger.info('Verifying email for user:', {
      email: user.email,
      hasToken: !!user.emailVerificationToken,
      expiresAt: user.emailVerificationExpires,
      currentTime: new Date(),
      isExpired: user.emailVerificationExpires ? new Date() > user.emailVerificationExpires : 'NO_EXPIRY_SET',
    });

    // Check if verification token exists
    if (!user.emailVerificationToken || !user.emailVerificationExpires) {
      return next(new AppError('Verification code not found. Please request a new one', 400));
    }

    // Check if OTP is expired
    if (new Date() > user.emailVerificationExpires) {
      return next(new AppError('Verification code has expired. Please request a new one', 400));
    }

    // Verify OTP
    const hashedOTP = hashData(otp);
    logger.info('OTP comparison:', {
      providedOTPHash: hashedOTP,
      storedHash: user.emailVerificationToken,
      match: hashedOTP === user.emailVerificationToken,
    });
    
    if (hashedOTP !== user.emailVerificationToken) {
      return next(new AppError('Invalid verification code', 400));
    }

    // Mark as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Send welcome email asynchronously (don't block response)
    emailService.sendWelcomeEmail(user)
      .then(() => logger.info('Welcome email sent'))
      .catch((emailError) => logger.error('Failed to send welcome email:', emailError));

    // Generate tokens
    const token = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.isEmailVerified) {
      return next(new AppError('Email already verified', 400));
    }

    // Generate new OTP
    const otp = generateOTP(6);
    const hashedOTP = hashData(otp);

    user.emailVerificationToken = hashedOTP;
    user.emailVerificationExpires = addDays(new Date(), 1);
    await user.save();

    // Send verification email asynchronously (don't block response)
    emailService.sendVerificationEmail(user, otp)
      .then(() => logger.info('Resend verification email sent'))
      .catch((emailError) => logger.error('Failed to resend verification email:', emailError));

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user and select password
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // Check if account is active
    if (!user.isActive) {
      return next(new AppError('Your account has been suspended. Please contact support', 403));
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email before logging in', 403));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const token = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a password reset link has been sent',
      });
    }

    // Generate reset token
    const resetToken = generateOTP(32);
    const hashedToken = hashData(resetToken);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user, resetToken);
    } catch (emailError) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      
      return next(new AppError('Error sending password reset email. Please try again', 500));
    }

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = hashData(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken');

    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    // Update password
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Generate new tokens
    const authToken = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        token: authToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if user exists
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Generate new tokens
    const newToken = generateToken({ id: user._id });
    const newRefreshToken = generateRefreshToken({ id: user._id });

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }
};

// Logout
// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // Remove device token if provided
    const { deviceToken } = req.body;
    
    if (deviceToken && req.user) {
      req.user.deviceTokens = req.user.deviceTokens.filter(token => token !== deviceToken);
      await req.user.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get current authenticated user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};
