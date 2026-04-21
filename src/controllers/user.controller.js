
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { AppError } = require('../middleware/error.middleware');
const { sanitizeUser } = require('../utils/helpers.util');
const kycService = require('../services/kyc.service');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const wallet = await Wallet.findOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        wallet: {
          balance: wallet?.balance || 0,
          tier: user.walletTier,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, address } = req.body;

    const user = await User.findById(req.user._id);

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res, next) => {
  try {
    // TODO: Implement file upload to S3/Cloudinary
    const { imageUrl } = req.body; // Temporary: expect URL from frontend

    const user = await User.findById(req.user._id);
    user.profilePicture = imageUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify BVN
exports.verifyBVN = async (req, res, next) => {
  try {
    const { bvn, firstName, lastName, dateOfBirth } = req.body;

    const user = await User.findById(req.user._id);

    // Check if already verified
    if (user.kycStatus === 'verified') {
      return next(new AppError('KYC already verified', 400));
    }

    // Check if BVN already submitted
    if (user.bvn) {
      return next(new AppError('BVN already submitted', 400));
    }

    // Verify BVN with Smile Identity (or mock in development)
    const useMock = !process.env.SMILE_API_KEY || process.env.NODE_ENV === 'development';
    
    const verificationResult = useMock 
      ? await kycService.mockVerifyBVN({ bvn, firstName, lastName, dateOfBirth })
      : await kycService.verifyBVN({ bvn, firstName, lastName, dateOfBirth });

    if (!verificationResult.verified) {
      return next(new AppError('BVN verification failed. Please check your details', 400));
    }

    // Encrypt and store BVN
    const encryptedBVN = kycService.encryptAndStoreBVN(bvn);
    
    user.bvn = encryptedBVN;
    user.kycStatus = 'pending';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'BVN submitted successfully. Verification is pending',
      data: {
        kycStatus: user.kycStatus,
        verificationData: verificationResult.data,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify NIN
exports.verifyNIN = async (req, res, next) => {
  try {
    const { nin, firstName, lastName } = req.body;

    const user = await User.findById(req.user._id);

    // Check if already verified
    if (user.kycStatus === 'verified') {
      return next(new AppError('KYC already verified', 400));
    }

    // Check if NIN already submitted
    if (user.nin) {
      return next(new AppError('NIN already submitted', 400));
    }

    // Verify NIN with Smile Identity (or mock in development)
    const useMock = !process.env.SMILE_API_KEY || process.env.NODE_ENV === 'development';
    
    const verificationResult = useMock 
      ? await kycService.mockVerifyNIN({ nin, firstName, lastName })
      : await kycService.verifyNIN({ nin, firstName, lastName });

    if (!verificationResult.verified) {
      return next(new AppError('NIN verification failed. Please check your details', 400));
    }

    // Encrypt and store NIN
    const encryptedNIN = kycService.encryptAndStoreNIN(nin);
    
    user.nin = encryptedNIN;
    user.kycStatus = 'pending';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'NIN submitted successfully. Verification is pending',
      data: {
        kycStatus: user.kycStatus,
        verificationData: verificationResult.data,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 400));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Set transaction PIN
exports.setTransactionPin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    logger.info(`setTransactionPin: requested by user ${req.user && req.user._id}`);
    console.log('DEBUG: setTransactionPin called with pin:', pin);

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return next(new AppError('Transaction PIN must be exactly 6 digits', 400));
    }

    console.log('DEBUG: Finding user with ID:', req.user._id);
    const user = await User.findById(req.user._id).select('+transactionPin');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    console.log('DEBUG: User found, transactionPin exists:', !!user.transactionPin);

    if (user.transactionPin) {
      return next(new AppError('Transaction PIN already set. Use change PIN endpoint', 400));
    }

    logger.info(`setTransactionPin: saving pin for user ${user._id}`);
    console.log('DEBUG: About to set PIN and save');

    // Set the PIN (will be hashed by pre-save hook)
    user.transactionPin = pin;
    // Explicitly mark as modified to ensure pre-save hook runs
    user.markModified('transactionPin');
    console.log('DEBUG: PIN set and marked as modified, about to call save()');
    
    await user.save({ validateBeforeSave: true, validateModifiedOnly: true });
    console.log('DEBUG: Save completed successfully');

    logger.info(`setTransactionPin: saved pin for user ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Transaction PIN set successfully',
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    logger.error('Set PIN Error:', error);
    console.error('DEBUG: Error in setTransactionPin:', error);
    next(error);
  }
};

// Change transaction PIN - OPTIMIZED
exports.changeTransactionPin = async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;

            logger.info(`setTransactionPin: saving transaction pin for user ${req.user._id}`);
    console.log('Changing transaction PIN for user:', req.user._id);

    // Validate new PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return next(new AppError('Transaction PIN must be exactly 6 digits', 400));
    }
            logger.info(`setTransactionPin: save complete for user ${req.user._id}`);

    const user = await User.findById(req.user._id).select('+transactionPin');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!user.transactionPin) {
      return next(new AppError('Transaction PIN not set. Use set PIN endpoint', 400));
    }

    console.log('Verifying current PIN...');

    // Verify current PIN
    const isMatch = await user.compareTransactionPin(currentPin);
    if (!isMatch) {
      return next(new AppError('Current PIN is incorrect', 400));
    }

    console.log('Setting new PIN...');

    // Update PIN
    user.transactionPin = newPin;
    // Explicitly mark as modified to ensure pre-save hook runs
    user.markModified('transactionPin');
    
    // Save with reduced validation
    await user.save({ 
      validateBeforeSave: true,
      validateModifiedOnly: true 
    });

    console.log('PIN changed successfully');

    res.status(200).json({
      success: true,
      message: 'Transaction PIN changed successfully',
    });
  } catch (error) {
    console.error('Change PIN Error:', error);
    next(error);
  }
};

// Verify transaction PIN - OPTIMIZED
exports.verifyTransactionPin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    console.log('Verifying transaction PIN for user:', req.user._id);

    const user = await User.findById(req.user._id).select('+transactionPin');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!user.transactionPin) {
      return next(new AppError('Transaction PIN not set', 400));
    }

    const isMatch = await user.compareTransactionPin(pin);

    res.status(200).json({
      success: true,
      data: {
        verified: isMatch,
      },
    });
  } catch (error) {
    console.error('Verify PIN Error:', error);
    next(error);
  }
};

// Update primary bank account
exports.updatePrimaryAccount = async (req, res, next) => {
  try {
    const { accountNumber, accountName, bankCode, bankName } = req.body;

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    wallet.primaryAccount = {
      accountNumber,
      accountName,
      bankCode,
      bankName,
    };

    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Primary bank account updated successfully',
      data: {
        primaryAccount: wallet.primaryAccount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Register device token for push notifications
exports.registerDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;

    const user = await User.findById(req.user._id);

    // Add token if not already present
    if (!user.deviceTokens.includes(deviceToken)) {
      user.deviceTokens.push(deviceToken);
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
    });
  } catch (error) {
    next(error);
  }
};