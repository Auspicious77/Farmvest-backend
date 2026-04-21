// Format currency (Naira)
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

// Calculate ROI
exports.calculateROI = (amount, percentage) => {
  return (amount * percentage) / 100;
};

// Calculate percentage change
exports.calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

// Generate date range
exports.generateDateRange = (startDate, endDate) => {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

// Add days to date
exports.addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Check if date is expired
exports.isExpired = (date) => {
  return new Date() > new Date(date);
};

// Sanitize user data (remove sensitive fields)
exports.sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.transactionPin;
  delete userObj.twoFactorSecret;
  delete userObj.emailVerificationToken;
  delete userObj.passwordResetToken;
  return userObj;
};

// Paginate results
exports.paginate = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit: parseInt(limit) };
};

// Build pagination response
exports.buildPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

// Generate unique reference
exports.generateReference = (prefix = 'REF') => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}-${timestamp}-${random}`;
};

// Validate Nigerian phone number
exports.validateNigerianPhone = (phone) => {
  const phoneRegex = /^(\+234|234|0)[789]\d{9}$/;
  return phoneRegex.test(phone);
};

// Format Nigerian phone number
exports.formatNigerianPhone = (phone) => {
  // Remove spaces and dashes
  phone = phone.replace(/[\s-]/g, '');
  
  // Convert to +234 format
  if (phone.startsWith('0')) {
    return '+234' + phone.slice(1);
  } else if (phone.startsWith('234')) {
    return '+' + phone;
  } else if (phone.startsWith('+234')) {
    return phone;
  }
  
  return phone;
};

// Validate BVN
exports.validateBVN = (bvn) => {
  return /^\d{11}$/.test(bvn);
};

// Validate NIN
exports.validateNIN = (nin) => {
  return /^\d{11}$/.test(nin);
};

// Calculate investment end date
exports.calculateEndDate = (startDate, duration) => {
  return exports.addDays(startDate, duration);
};

// Check wallet tier limit
exports.checkWalletLimit = (amount, tier) => {
  const limits = {
    basic: 100000, // ₦100,000
    verified: 10000000, // ₦10,000,000
  };
  
  return amount <= (limits[tier] || limits.basic);
};

// Upload file to S3/Cloudinary
exports.uploadToS3 = async (file) => {
  // For now, return a placeholder URL
  // TODO: Implement actual Cloudinary upload
  const cloudinary = require('cloudinary').v2;
  
  try {
    // Configure cloudinary if not already configured
    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }

    // For base64 or buffer
    if (file.buffer) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'farm-invest' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(file.buffer);
      });
    }
    
    // For file path
    if (file.path) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'farm-invest',
      });
      return result.secure_url;
    }

    // Return file data as is if already a URL
    if (typeof file === 'string' && (file.startsWith('http') || file.startsWith('data:'))) {
      if (file.startsWith('data:')) {
        const result = await cloudinary.uploader.upload(file, {
          folder: 'farm-invest',
        });
        return result.secure_url;
      }
      return file;
    }

    throw new Error('Invalid file format');
  } catch (error) {
    console.error('Upload error:', error);
    // Return a placeholder if upload fails
    return 'https://via.placeholder.com/400x300?text=Product+Image';
  }
};

