const User = require('../models/User');
const Product = require('../models/Product');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Revenue = require('../models/Revenue');
const { AppError } = require('../middleware/error.middleware');
const paystackService = require('../services/paystack.service');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// Dashboard analytics
exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // User statistics
    const [totalUsers, newUsers, verifiedUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ kycStatus: 'verified' }),
    ]);

    // Product statistics
    const [totalProducts, activeProducts] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'open' }),
    ]);

    // Investment statistics
    const investmentStats = await Investment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalValue: { $sum: '$currentValue' },
        },
      },
    ]);

    const totalInvestments = investmentStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalInvestedAmount = investmentStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    const totalCurrentValue = investmentStats.reduce((sum, stat) => sum + stat.totalValue, 0);

    // Transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Revenue calculation - Platform gets 20% of all ROI
    // Calculate revenue from Revenue collection (tracks 20% platform fee from price updates)
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthRevenue, lastMonthRevenue, totalRevenue, activeInvestmentsData] = await Promise.all([
      Revenue.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Revenue.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Revenue.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Calculate unrealized revenue from all active investments
      Investment.aggregate([
        {
          $match: {
            status: 'active'
          }
        },
        {
          $project: {
            _id: 1,
            quantity: 1,
            currentUnitPrice: 1,
            totalInvestment: 1,
            grossCurrentValue: { $multiply: ['$quantity', '$currentUnitPrice'] },
          }
        },
        {
          $project: {
            grossROI: { $subtract: ['$grossCurrentValue', '$totalInvestment'] },
          }
        },
        {
          $project: {
            platformFee: {
              $cond: {
                if: { $gt: ['$grossROI', 0] },
                then: { $multiply: ['$grossROI', 0.20] },
                else: 0
              }
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ])
    ]);

    const thisMonth = thisMonthRevenue[0]?.total || 0;
    const lastMonth = lastMonthRevenue[0]?.total || 0;
    const realizedRevenue = totalRevenue[0]?.total || 0;
    const unrealizedRevenue = activeInvestmentsData[0]?.total || 0;
    const totalPlatformRevenue = realizedRevenue + unrealizedRevenue;
    const revenueGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    // Recent activities
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'fullName email');

    const recentInvestments = await Investment.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'fullName email')
      .populate('product', 'name category');

    // Top performing products
    const topProducts = await Product.find()
      .sort({ currentROI: -1, currentInvestors: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          new: newUsers,
          verified: verifiedUsers,
          active: totalUsers - newUsers,
          suspended: 0, // TODO: Add suspended count
          growth: newUsers > 0 && totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
        },
        products: {
          total: totalProducts,
          active: activeProducts,
        },
        investments: {
          total: totalInvestments,
          active: investmentStats.find((s) => s._id === 'active')?.count || 0,
          completed: investmentStats.find((s) => s._id === 'completed')?.count || 0,
          totalAmount: totalInvestedAmount,
          growth: 0, // TODO: Calculate growth
        },
        transactions: {
          total: transactionStats.reduce((sum, stat) => sum + stat.count, 0),
          successful: transactionStats.find((s) => s._id === 'completed')?.count || 0,
          pending: transactionStats.find((s) => s._id === 'pending')?.count || 0,
          totalVolume: transactionStats.reduce((sum, stat) => sum + stat.totalAmount, 0),
          growth: 0, // TODO: Calculate growth
        },
        revenue: {
          total: totalPlatformRevenue,
          realized: realizedRevenue,
          unrealized: unrealizedRevenue,
          thisMonth,
          lastMonth,
          growth: revenueGrowth,
        },
        recentActivity: {
          transactions: recentTransactions,
          investments: recentInvestments,
        },
        topProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, kycStatus, search } = req.query;

    const query = {};
    if (kycStatus) query.kycStatus = kycStatus;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -transactionPin -refreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new user (admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role,
      isEmailVerified: true, // Admin-created users are auto-verified
    });

    // Create wallet for user
    await Wallet.create({
      user: user._id,
      balance: 0,
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.fullName);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user details
exports.getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -transactionPin -refreshToken');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const wallet = await Wallet.findOne({ user: id });

    const [investments, transactions] = await Promise.all([
      Investment.find({ user: id })
        .populate('product', 'name category')
        .sort({ createdAt: -1 })
        .limit(10),
      Transaction.find({ user: id }).sort({ createdAt: -1 }).limit(10),
    ]);

    const investmentSummary = await Investment.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Merge user with additional data for consistency
    const userWithDetails = {
      ...user.toObject(),
      wallet,
      recentInvestments: investments,
      recentTransactions: transactions,
      investmentSummary,
    };

    res.status(200).json({
      success: true,
      data: userWithDetails,
    });
  } catch (error) {
    next(error);
  }
};

// Update user KYC status
exports.updateUserKYCStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kycStatus, reason } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.kycStatus = kycStatus;
    if (kycStatus === 'verified') {
      user.walletTier = 'verified';
    }
    await user.save();

    // Send email notification
    await emailService.sendKYCStatusEmail(user, kycStatus, reason);

    logger.info(`KYC status updated: User ${user.email} - ${kycStatus} by admin ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'KYC status updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Suspend/Activate user
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.isActive = !user.isActive;
    await user.save();

    logger.info(
      `User ${user.isActive ? 'activated' : 'suspended'}: ${user.email} by admin ${req.user.email}`
    );

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'suspended'} successfully`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Get pending withdrawals
exports.getPendingWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      Transaction.find({
        type: 'withdrawal',
        status: 'pending',
      })
        .populate('user', 'fullName email phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments({
        type: 'withdrawal',
        status: 'pending',
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process withdrawal
exports.processWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const transaction = await Transaction.findById(id).populate('user wallet');

    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    if (transaction.type !== 'withdrawal') {
      return next(new AppError('This is not a withdrawal transaction', 400));
    }

    if (transaction.status !== 'pending') {
      return next(new AppError('This withdrawal has already been processed', 400));
    }

    if (action === 'approve') {
      // Initiate transfer via Paystack
      const transfer = await paystackService.initiateTransfer(
        transaction.amount,
        transaction.destinationAccount.accountNumber,
        transaction.destinationAccount.bankCode,
        transaction.destinationAccount.accountName,
        transaction.reference
      );

      if (transfer.success) {
        transaction.status = 'processing';
        transaction.metadata = {
          ...transaction.metadata,
          transferCode: transfer.transferCode,
          approvedBy: req.user._id,
          approvedAt: new Date(),
        };
        await transaction.save();

        logger.info(`Withdrawal approved: ${transaction.reference} by ${req.user.email}`);

        res.status(200).json({
          success: true,
          message: 'Withdrawal approved and transfer initiated',
          data: { transaction },
        });
      } else {
        return next(new AppError('Failed to initiate transfer', 500));
      }
    } else if (action === 'reject') {
      // Refund to wallet
      const wallet = await Wallet.findById(transaction.wallet);
      await wallet.credit(transaction.amount, 'refund');

      transaction.status = 'failed';
      transaction.metadata = {
        ...transaction.metadata,
        rejectedBy: req.user._id,
        rejectedAt: new Date(),
        reason: req.body.reason || 'Rejected by admin',
      };
      await transaction.save();

      // Send notification
      await emailService.sendTransactionNotification(
        transaction.user.email,
        transaction.user.fullName,
        'Withdrawal Rejected',
        `Your withdrawal request has been rejected. ₦${(transaction.amount || 0).toLocaleString()} has been refunded to your wallet.`,
        transaction
      );

      logger.info(`Withdrawal rejected: ${transaction.reference} by ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Withdrawal rejected and amount refunded',
        data: { transaction },
      });
    } else {
      return next(new AppError('Invalid action. Use "approve" or "reject"', 400));
    }
  } catch (error) {
    next(error);
  }
};

// Get system statistics
exports.getSystemStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Revenue metrics
    const transactionVolume = await Transaction.aggregate([
      { $match: { status: 'completed', ...query } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Growth metrics
    const userGrowth = await User.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const investmentGrowth = await Investment.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Category performance
    const categoryPerformance = await Investment.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData',
        },
      },
      { $unwind: '$productData' },
      {
        $group: {
          _id: '$productData.category',
          investmentCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgROI: { $avg: '$currentROI' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactionVolume,
        userGrowth,
        investmentGrowth,
        categoryPerformance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updates.password;
    delete updates.transactionPin;
    delete updates.role; // Role changes should be handled separately

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select('-password -transactionPin');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Delete associated wallet
    await Wallet.findOneAndDelete({ user: id });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Approve user KYC
exports.approveUserKYC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        kycStatus: 'verified',
        'kyc.verifiedAt': new Date(),
        'kyc.adminNotes': notes,
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Send notification to user
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'KYC Verification Approved',
        text: `Your KYC verification has been approved. You can now access all platform features.`,
      });
    } catch (emailError) {
      logger.error('Failed to send KYC approval email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'KYC approved successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Reject user KYC
exports.rejectUserKYC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(new AppError('Rejection reason is required', 400));
    }

    const user = await User.findByIdAndUpdate(
      id,
      {
        kycStatus: 'rejected',
        'kyc.rejectionReason': reason,
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Send notification to user
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'KYC Verification Rejected',
        text: `Your KYC verification has been rejected. Reason: ${reason}`,
      });
    } catch (emailError) {
      logger.error('Failed to send KYC rejection email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'KYC rejected successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Suspend user
exports.suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isActive: false,
        suspensionReason: reason,
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    logger.info(`User suspended: ${user.email} by admin. Reason: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'User suspended successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Activate user
exports.activateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isActive: true,
        $unset: { suspensionReason: 1 },
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    logger.info(`User activated: ${user.email} by admin`);

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk suspend users
exports.bulkSuspendUsers = async (req, res, next) => {
  try {
    const { userIds, reason } = req.body;

    await User.updateMany(
      { _id: { $in: userIds } },
      {
        isActive: false,
        suspensionReason: reason,
      }
    );

    logger.info(`${userIds.length} users bulk suspended by admin`);

    res.status(200).json({
      success: true,
      message: `${userIds.length} users suspended successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk activate users
exports.bulkActivateUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    await User.updateMany(
      { _id: { $in: userIds } },
      {
        isActive: true,
        $unset: { suspensionReason: 1 },
      }
    );

    logger.info(`${userIds.length} users bulk activated by admin`);

    res.status(200).json({
      success: true,
      message: `${userIds.length} users activated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk delete users
exports.bulkDeleteUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    await User.deleteMany({ _id: { $in: userIds } });
    await Wallet.deleteMany({ user: { $in: userIds } });

    res.status(200).json({
      success: true,
      message: `${userIds.length} users deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Export users
exports.exportUsers = async (req, res, next) => {
  try {
    const { format = 'csv', status, kycStatus, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (kycStatus) query.kycStatus = kycStatus;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).select('-password -transactionPin');

    // For now, return JSON data
    // TODO: Implement CSV/Excel export
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// Approve withdrawal
exports.approveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transactionReference, adminNotes } = req.body;

    const withdrawal = await Transaction.findById(id);

    if (!withdrawal) {
      return next(new AppError('Withdrawal not found', 404));
    }

    if (withdrawal.status !== 'pending') {
      return next(new AppError('Withdrawal is not pending', 400));
    }

    withdrawal.status = 'successful';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.transactionReference = transactionReference;
    withdrawal.adminNotes = adminNotes;
    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: { withdrawal },
    });
  } catch (error) {
    next(error);
  }
};

// Reject withdrawal
exports.rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(new AppError('Rejection reason is required', 400));
    }

    const withdrawal = await Transaction.findById(id);

    if (!withdrawal) {
      return next(new AppError('Withdrawal not found', 404));
    }

    if (withdrawal.status !== 'pending') {
      return next(new AppError('Withdrawal is not pending', 400));
    }

    withdrawal.status = 'failed';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.failureReason = reason;
    await withdrawal.save();

    // Refund to wallet
    const wallet = await Wallet.findOne({ user: withdrawal.user });
    if (wallet) {
      wallet.balance += withdrawal.amount;
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      message: 'Withdrawal rejected successfully',
      data: { withdrawal },
    });
  } catch (error) {
    next(error);
  }
};

// Batch approve withdrawals
exports.batchApproveWithdrawals = async (req, res, next) => {
  try {
    const { withdrawalIds, adminNotes } = req.body;

    const result = await Transaction.updateMany(
      { _id: { $in: withdrawalIds }, status: 'pending' },
      {
        status: 'completed',
        processedAt: new Date(),
        processedBy: req.user._id,
        adminNotes,
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} withdrawals approved successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Get all investments
exports.getAllInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, productId, userId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (productId) query.product = productId;
    if (userId) query.user = userId;

    const investments = await Investment.find(query)
      .populate('user', 'fullName email phone')
      .populate('product', 'name category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate ROI and ensure all values are set
    const formattedInvestments = investments.map(inv => {
      inv.calculateCurrentValue();
      inv.calculateROI();
      
      return {
        ...inv.toObject(),
        currentROI: inv.roiPercentage || 0,
        currentValue: inv.currentValue || inv.totalInvestment || 0,
        amount: inv.totalInvestment || 0,
        maturityDate: inv.endDate,
      };
    });

    const total = await Investment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: formattedInvestments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get investment details
exports.getInvestmentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const investment = await Investment.findById(id)
      .populate('user', 'fullName email phone')
      .populate('product');

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { investment },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel investment
exports.cancelInvestment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const investment = await Investment.findById(id);

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    if (investment.status !== 'active') {
      return next(new AppError('Only active investments can be cancelled', 400));
    }

    investment.status = 'cancelled';
    investment.cancellationReason = reason;
    investment.cancelledAt = new Date();
    await investment.save();

    // Refund to wallet
    const wallet = await Wallet.findOne({ user: investment.user });
    if (wallet) {
      wallet.balance += investment.amount;
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      message: 'Investment cancelled successfully',
      data: { investment },
    });
  } catch (error) {
    next(error);
  }
};

// Update investment status
exports.updateInvestmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const investment = await Investment.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Investment status updated successfully',
      data: { investment },
    });
  } catch (error) {
    next(error);
  }
};

// Export investments
exports.exportInvestments = async (req, res, next) => {
  try {
    const { status, productId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (productId) query.product = productId;

    const investments = await Investment.find(query)
      .populate('user', 'fullName email phone')
      .populate('product', 'name category');

    res.status(200).json({
      success: true,
      data: investments,
    });
  } catch (error) {
    next(error);
  }
};

// Get all transactions
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, userId } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (userId) query.user = userId;

    const transactions = await Transaction.find(query)
      .populate('user', 'fullName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get transaction details
exports.getTransactionDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id).populate('user', 'fullName email phone');

    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

// Export transactions
exports.exportTransactions = async (req, res, next) => {
  try {
    const { type, status } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await Transaction.find(query).populate('user', 'fullName email phone');

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// Get user growth analytics
exports.getUserGrowthAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    // Parse period (30d, 90d, 1y, etc.)
    let daysBack = 30;
    if (period.endsWith('d')) {
      daysBack = parseInt(period);
    } else if (period === '1y') {
      daysBack = 365;
    } else if (period === '6m') {
      daysBack = 180;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const users = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          users: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$kycStatus', 'verified'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format data to match frontend expectations (date, users, verified)
    const formattedData = users.map(item => ({
      date: item._id,
      users: item.users,
      verified: item.verified,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

// Get revenue analytics
exports.getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = '6m' } = req.query;
    
    let daysBack = 180;
    if (period.endsWith('m')) {
      daysBack = parseInt(period) * 30;
    } else if (period.endsWith('d')) {
      daysBack = parseInt(period);
    } else if (period === '1y') {
      daysBack = 365;
    } else if (period === '2y') {
      daysBack = 730;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get platform revenue from Revenue collection (20% of ROI from price updates)
    const platformRevenue = await Revenue.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get investments by month
    const investmentsByMonth = await Investment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          amount: { $sum: '$totalInvestment' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get withdrawals by month
    const withdrawalsByMonth = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          type: 'withdrawal',
          status: 'successful'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Merge all data by month
    const monthsMap = new Map();
    
    platformRevenue.forEach(item => {
      const month = item._id;
      monthsMap.set(month, { 
        month, 
        revenue: item.amount,
        investments: 0,
        withdrawals: 0
      });
    });

    investmentsByMonth.forEach(item => {
      const month = item._id;
      if (!monthsMap.has(month)) {
        monthsMap.set(month, { month, revenue: 0, investments: 0, withdrawals: 0 });
      }
      monthsMap.get(month).investments = item.amount;
    });

    withdrawalsByMonth.forEach(item => {
      const month = item._id;
      if (!monthsMap.has(month)) {
        monthsMap.set(month, { month, revenue: 0, investments: 0, withdrawals: 0 });
      }
      monthsMap.get(month).withdrawals = item.amount;
    });

    const revenueData = Array.from(monthsMap.values()).sort((a, b) => 
      a.month.localeCompare(b.month)
    );

    res.status(200).json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    next(error);
  }
};

// Get investments analytics
exports.getInvestmentsAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    let daysBack = 30;
    if (period.endsWith('d')) {
      daysBack = parseInt(period);
    } else if (period === '1y') {
      daysBack = 365;
    } else if (period === '6m') {
      daysBack = 180;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const investments = await Investment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$totalInvestment' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format data to match frontend expectations
    const formattedData = investments.map(item => ({
      date: item._id,
      amount: item.amount,
      count: item.count,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

// Get category distribution
exports.getCategoryDistribution = async (req, res, next) => {
  try {
    const distribution = await Investment.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      {
        $unwind: '$productData'
      },
      {
        $group: {
          _id: '$productData.category',
          count: { $sum: 1 },
          amount: { $sum: '$totalInvestment' }
        }
      }
    ]);

    // Calculate total for percentages
    const total = distribution.reduce((sum, item) => sum + item.amount, 0);

    // Format data to match frontend expectations (category, amount, count, percentage)
    const formattedData = distribution.map(item => ({
      category: item._id,
      amount: item.amount,
      count: item.count,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Format activities
    const activities = recentTransactions.map(tx => ({
      id: tx._id,
      type: tx.type,
      user: tx.user?.fullName || 'Unknown',
      userEmail: tx.user?.email || 'N/A',
      amount: tx.amount,
      status: tx.status,
      description: tx.description || `${tx.type} transaction`,
      timestamp: tx.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

// Get product performance analytics
exports.getProductPerformance = async (req, res, next) => {
  try {
    const Product = require('../models/Product');
    const Investment = require('../models/Investment');

    // Get all products with their investment data
    const products = await Product.find({ status: 'active' });

    const performanceData = await Promise.all(
      products.map(async (product) => {
        // Get investment statistics for this product
        const investmentStats = await Investment.aggregate([
          { $match: { product: product._id } },
          {
            $group: {
              _id: null,
              totalInvested: { $sum: '$amount' },
              investorsCount: { $sum: 1 },
            },
          },
        ]);

        const stats = investmentStats[0] || { totalInvested: 0, investorsCount: 0 };

        // Calculate current ROI (from product's ROI range average)
        const currentROI = product.roiRange 
          ? (product.roiRange.min + product.roiRange.max) / 2 
          : 0;

        // Calculate performance percentage (invested vs target)
        const performance = product.targetAmount > 0 
          ? (stats.totalInvested / product.targetAmount) * 100 
          : 0;

        return {
          productId: product._id,
          productName: product.name,
          category: product.category,
          totalInvested: stats.totalInvested,
          investorsCount: stats.investorsCount,
          currentROI: currentROI,
          performance: Math.min(performance, 100), // Cap at 100%
        };
      })
    );

    // Sort by total invested (descending)
    performanceData.sort((a, b) => b.totalInvested - a.totalInvested);

    res.status(200).json({
      success: true,
      data: performanceData,
    });
  } catch (error) {
    next(error);
  }
};

// Get user investments
exports.getUserInvestments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const [investments, total] = await Promise.all([
      Investment.find({ user: id })
        .populate('product', 'name category imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Investment.countDocuments({ user: id }),
    ]);

    res.status(200).json({
      success: true,
      data: investments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user transactions
exports.getUserTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ user: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments({ user: id }),
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user activities
exports.getUserActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    // Get user's transactions as activities
    const [transactions, total] = await Promise.all([
      Transaction.find({ user: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments({ user: id }),
    ]);

    // Format activities
    const activities = transactions.map(tx => ({
      id: tx._id,
      type: tx.type,
      description: tx.description || `${tx.type} transaction`,
      amount: tx.amount,
      status: tx.status,
      timestamp: tx.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};


// Get all notifications (admin view)
exports.getAllNotifications = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find()
        .populate('user', 'fullName email profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(),
    ]);

    // Calculate delivery stats
    const stats = {
      totalSent: total,
      read: await Notification.countDocuments({ isRead: true }),
      unread: await Notification.countDocuments({ isRead: false }),
    };

    res.status(200).json({
      success: true,
      data: notifications,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update notification
exports.updateNotification = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    const { id } = req.params;
    const { title, message, type } = req.body;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { title, message, type },
      { new: true, runValidators: true }
    ).populate('user', 'fullName email profilePicture');

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification
exports.deleteNotification = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get all activity logs
exports.getActivityLogs = async (req, res, next) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    const { 
      page = 1, 
      limit = 20, 
      action, 
      resource, 
      startDate, 
      endDate,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (action && action !== 'all') {
      query.action = action;
    }
    
    if (resource && resource !== 'all') {
      query.resource = resource;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { details: { $regex: search, $options: 'i' } },
        { resourceId: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } },
      ];
    }
    
    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .populate('adminUser', 'fullName email profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ActivityLog.countDocuments(query),
    ]);
    
    // Calculate stats
    const stats = {
      total,
      today: await ActivityLog.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      activeAdmins: await ActivityLog.distinct('adminUser', query),
    };
    
    res.status(200).json({
      success: true,
      data: logs,
      stats: {
        ...stats,
        activeAdmins: stats.activeAdmins.length,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create activity log (helper function)
exports.createActivityLog = async (adminUserId, action, resource, details, metadata = {}, resourceId = null) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    
    // Get IP address from request context if available
    const ipAddress = metadata.ipAddress || 'Unknown';
    const userAgent = metadata.userAgent || null;
    
    const log = await ActivityLog.create({
      adminUser: adminUserId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      details,
      metadata,
      status: 'success',
    });
    
    return log;
  } catch (error) {
    logger.error('Failed to create activity log:', error);
    // Don't throw error to prevent disrupting main operations
  }
};

// Export activity logs
exports.exportActivityLogs = async (req, res, next) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    const { action, resource, startDate, endDate } = req.query;
    
    // Build query
    const query = {};
    
    if (action && action !== 'all') {
      query.action = action;
    }
    
    if (resource && resource !== 'all') {
      query.resource = resource;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const logs = await ActivityLog.find(query)
      .populate('adminUser', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent memory issues
    
    // Create CSV content
    const csvRows = [];
    csvRows.push(['Timestamp', 'Admin User', 'Email', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Details'].join(','));
    
    logs.forEach(log => {
      const row = [
        log.createdAt.toISOString(),
        log.adminUser?.fullName || 'Unknown',
        log.adminUser?.email || 'Unknown',
        log.action,
        log.resource,
        log.resourceId || '',
        log.ipAddress,
        `"${log.details.replace(/"/g, '""')}"`, // Escape quotes in CSV
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};
