const Investment = require('../models/Investment');
const Product = require('../models/Product');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error.middleware');
const emailService = require('../services/email.service');
const { emitWalletUpdate } = require('../sockets/performance.socket');
const logger = require('../utils/logger');

// Get all user investments
exports.getMyInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [investments, total] = await Promise.all([
      Investment.find(query)
        .populate('product', 'name category image duration roiRange unitType unitPrice currentPrice')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Investment.countDocuments(query),
    ]);

    // Calculate summary statistics
    const stats = await Investment.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalInvestment: { $sum: '$totalInvestment' },
          totalCurrentValue: { $sum: '$currentValue' },
          totalROI: { $sum: '$roiEarned' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        investments,
        stats,
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

// Get investment by ID
exports.getInvestmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const investment = await Investment.findOne({
      _id: id,
      user: req.user._id,
    }).populate('product');

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        investment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new investment
exports.createInvestment = async (req, res, next) => {
  try {
    const { productId, quantity, pin, duration: customDuration } = req.body;

    // Verify transaction PIN
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('+transactionPin');

    if (!user.transactionPin) {
      return next(new AppError('Please set up your transaction PIN first', 400));
    }

    const isPinValid = await user.compareTransactionPin(pin);
    if (!isPinValid) {
      return next(new AppError('Invalid transaction PIN', 400));
    }

    // Get product
    const product = await Product.findById(productId);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'open') {
      return next(new AppError('This product is not currently accepting investments', 400));
    }

    // Validate investment quantity
    if (!quantity || quantity < product.minQuantity) {
      return next(
        new AppError(`Minimum quantity for this product is ${product.minQuantity} ${product.unitType}(s)`, 400)
      );
    }

    if (quantity > product.maxQuantity) {
      return next(
        new AppError(`Maximum quantity for this product is ${product.maxQuantity} ${product.unitType}(s)`, 400)
      );
    }

    // Validate unit price exists
    if (!product.unitPrice || product.unitPrice <= 0) {
      return next(new AppError('Product unit price is not set', 400));
    }

    // New investors ALWAYS use currentPrice as their entry price
    // If currentPrice is not set or is 0, fall back to unitPrice
    const investorBasePrice = product.currentPrice && product.currentPrice > 0 
      ? product.currentPrice 
      : product.unitPrice;

    // Calculate total investment amount using the current market price
    const totalInvestment = quantity * investorBasePrice;

    // Check if product has available slots
    if (product.investorsCount >= product.maxInvestors) {
      return next(new AppError('This product has reached maximum investors', 400));
    }

    // Get wallet
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Check wallet balance
    if (!wallet.hasSufficientBalance(totalInvestment)) {
      return next(new AppError('Insufficient wallet balance', 400));
    }

    // Use custom duration if provided, otherwise use product's default duration
    const investmentDuration = customDuration || product.duration;

    // Validate custom duration if provided
    if (customDuration) {
      if (customDuration < 1) {
        return next(new AppError('Investment duration must be at least 1 month', 400));
      }
      
      // Ensure custom duration doesn't exceed product's maximum duration
      if (customDuration > product.duration) {
        return next(
          new AppError(
            `Investment duration cannot exceed ${product.duration} months (product maximum duration)`,
            400
          )
        );
      }
    }

    // Calculate start and end dates (duration is in months)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + investmentDuration);
    
    // Calculate duration in days for storage
    const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Create investment with quantity-based model
    const investment = await Investment.create({
      user: req.user._id,
      product: product._id,
      quantity,
      unitPrice: investorBasePrice, // Use current price as base for new investors
      currentUnitPrice: investorBasePrice,
      totalInvestment,
      currentValue: totalInvestment, // Starts at investment amount (no ROI yet)
      roiPercentage: 0,
      roiEarned: 0,
      platformFee: 0,
      netRoiEarned: 0,
      startDate,
      endDate,
      duration: durationInDays,
      status: 'active',
      priceSnapshots: [{
        date: startDate,
        price: investorBasePrice,
        value: totalInvestment,
        percentageChange: 0,
      }],
    });

    // Debit wallet
    await wallet.debit(totalInvestment, 'investment');

    // Create transaction record
    const transaction = await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: 'investment',
      amount: totalInvestment,
      reference: Transaction.generateReference('INV'),
      status: 'successful',
      completedAt: new Date(),
      description: `Investment: ${quantity} ${product.unitType}(s) of ${product.name}`,
      metadata: {
        investmentId: investment._id,
        productId: product._id,
        quantity,
        unitPrice: investorBasePrice, // Store the actual price paid (current price)
        basePrice: product.unitPrice, // Store original base price for reference
        currentPrice: product.currentPrice, // Store market price at time of investment
      },
    });

    // Update product investor count
    product.investorsCount += 1;
    await product.save();

    // Create notification
    await Notification.create({
      user: req.user.id,
      type: 'investment',
      title: 'Investment Created',
      message: `Your investment of ${quantity || 0} ${product.unitType || 'unit'}(s) (₦${(totalInvestment || 0).toLocaleString()}) in ${product.name || 'product'} has been created successfully`,
      metadata: {
        investmentId: investment._id,
        productId: product._id,
      },
    });

    // Log investment object for debugging
    logger.info('Investment object before email:', {
      exists: !!investment,
      totalInvestment: investment?.totalInvestment,
      unitPrice: investment?.unitPrice,
      quantity: investment?.quantity,
      duration: investment?.duration,
    });

    // Send email notification
    if (investment && product && req.user) {
      try {
        await emailService.sendInvestmentConfirmation(
          req.user,
          investment,
          product
        );
      } catch (emailError) {
        // Log email error but don't fail the investment creation
        logger.error('Failed to send investment confirmation email:', {
          error: emailError.message,
          stack: emailError.stack,
        });
      }
    }

    // Emit wallet update
    emitWalletUpdate(req.user._id, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    logger.info(
      `Investment created: User ${req.user?.email || 'unknown'}, Product: ${product?.name || 'unknown'}, Amount: ₦${(totalInvestment || 0).toLocaleString()}`
    );

    res.status(201).json({
      success: true,
      message: 'Investment created successfully',
      data: {
        investment: await Investment.findById(investment._id).populate('product'),
        newWalletBalance: wallet.balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get investment performance
exports.getInvestmentPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const investment = await Investment.findOne({
      _id: id,
      user: req.user._id,
    }).populate('product', 'name category');

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    // Get performance data for last N days
    const numDays = parseInt(days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - numDays);

    let performanceHistory = (investment.priceSnapshots || []).filter(
      (entry) => new Date(entry.date) >= cutoffDate
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    // If no data, create initial data point
    if (performanceHistory.length === 0) {
      performanceHistory = [{
        date: investment.startDate || new Date(),
        value: investment.totalInvestment,
        price: investment.unitPrice,
        percentageChange: 0,
      }];
    }

    // Format dates based on time range
    const formatDate = (date, range) => {
      const d = new Date(date);
      if (range <= 7) {
        // 7 days: Show day names (Mon, Tue, Wed)
        return d.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (range <= 30) {
        // 1 month: Show month/day (12/01)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // 3M, 6M, 1Y: Show month (Jan, Feb)
        return d.toLocaleDateString('en-US', { month: 'short' });
      }
    };

    res.status(200).json({
      success: true,
      data: {
        performance: performanceHistory.map(entry => ({
          date: entry.date,
          dateLabel: formatDate(entry.date, numDays),
          value: entry.value || 0,
          price: entry.price || 0,
          percentageChange: entry.percentageChange || 0,
        })),
        timeRange: numDays,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get investment dashboard summary
exports.getInvestmentSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all investments
    const investments = await Investment.find({ user: userId }).populate('product', 'name category');

    // Calculate summary with quantity-based model
    const totalInvested = investments.reduce((sum, inv) => sum + inv.totalInvestment, 0);
    const totalCurrentValue = investments.reduce((sum, inv) => {
      inv.calculateCurrentValue();
      return sum + inv.currentValue;
    }, 0);
    const totalROIEarned = investments.reduce((sum, inv) => {
      inv.calculateROI();
      return sum + inv.roiEarned;
    }, 0);

    const activeInvestments = investments.filter((inv) => inv.status === 'active').length;
    const completedInvestments = investments.filter((inv) => inv.status === 'completed').length;

    // Get investments by category
    const investmentsByCategory = investments.reduce((acc, inv) => {
      const category = inv.product.category;
      if (!acc[category]) {
        acc[category] = { count: 0, totalInvestment: 0, currentValue: 0 };
      }
      acc[category].count += 1;
      acc[category].totalInvestment += inv.totalInvestment;
      acc[category].currentValue += inv.currentValue;
      return acc;
    }, {});

    // Get upcoming maturities (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingMaturities = investments.filter(
      (inv) =>
        inv.status === 'active' &&
        new Date(inv.endDate) <= thirtyDaysFromNow &&
        new Date(inv.endDate) > new Date()
    );

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalInvested,
          totalCurrentValue,
          totalROIEarned,
          totalROIPercentage: totalInvested > 0 ? (totalROIEarned / totalInvested) * 100 : 0,
          activeInvestments,
          completedInvestments,
          totalInvestments: investments.length,
        },
        investmentsByCategory,
        upcomingMaturities: upcomingMaturities.map((inv) => ({
          id: inv._id,
          product: inv.product,
          quantity: inv.quantity,
          totalInvestment: inv.totalInvestment,
          currentValue: inv.currentValue,
          endDate: inv.endDate,
          daysRemaining: inv.daysRemaining(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Withdraw matured investment (User withdraws to wallet)
exports.withdrawInvestment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    // Verify transaction PIN
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('+transactionPin');

    if (!user.transactionPin) {
      return next(new AppError('Please set up your transaction PIN first', 400));
    }

    const isPinValid = await user.compareTransactionPin(pin);
    if (!isPinValid) {
      return next(new AppError('Incorrect transaction PIN', 401));
    }

    // Get investment
    const investment = await Investment.findOne({
      _id: id,
      user: req.user._id,
    }).populate('product');

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    // Check if already withdrawn or completed
    if (investment.status === 'withdrawn') {
      return next(new AppError('Investment has already been withdrawn', 400));
    }

    if (investment.status === 'completed') {
      return next(new AppError('Investment has already been completed', 400));
    }

    // Check if investment has matured
    const now = new Date();
    const endDate = new Date(investment.endDate);
    
    if (now < endDate) {
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      return next(new AppError(`Investment has not matured yet. ${daysRemaining} day(s) remaining`, 400));
    }

    // Calculate final value with platform fee
    investment.calculateCurrentValue();
    investment.calculateROI();
    
    const totalPayout = investment.currentValue; // This already includes only 80% of ROI
    const platformFee = investment.platformFee;

    // Get user wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Credit wallet with the investment returns (initial investment + net ROI)
    await wallet.credit(totalPayout, 'investment_payout');

    // Create transaction record
    await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: 'roi_payout',
      amount: totalPayout,
      reference: Transaction.generateReference('PAYOUT'),
      status: 'successful',
      completedAt: new Date(),
      description: `Investment withdrawal for ${investment.product.name}`,
      metadata: {
        investmentId: investment._id,
        productId: investment.product._id,
        quantity: investment.quantity,
        principal: investment.totalInvestment,
        grossROI: investment.roiEarned + platformFee, // Total ROI before fee
        platformFee: platformFee,
        netROI: investment.netRoiEarned, // 80% of ROI
        totalPayout: totalPayout,
      },
    });

    // Update investment status
    investment.status = 'withdrawn';
    investment.completedAt = new Date();
    await investment.save();

    // Update product investor count
    const product = await Product.findById(investment.product._id);
    if (product) {
      product.investorsCount = Math.max(0, product.investorsCount - 1);
      await product.save();
    }

    // Create notification
    await Notification.create({
      user: req.user._id,
      type: 'investment_withdrawn',
      title: 'Investment Withdrawn',
      message: `Your investment in ${investment.product?.name || 'product'} has been withdrawn. ₦${(totalPayout || 0).toLocaleString()} has been credited to your wallet`,
      metadata: {
        investmentId: investment._id,
        amount: totalPayout,
        platformFee: platformFee,
      },
    });

    // Send email notification
    await emailService.sendInvestmentWithdrawalNotification(
      user.email,
      user.fullName,
      investment,
      totalPayout,
      platformFee
    );

    // Emit wallet update via socket
    emitWalletUpdate(req.user._id, {
      balance: wallet.balance,
    });

    res.status(200).json({
      success: true,
      message: 'Investment withdrawn successfully',
      data: {
        investment,
        payout: {
          totalPayout,
          principal: investment.totalInvestment,
          grossROI: investment.roiEarned + platformFee,
          platformFee: platformFee,
          netROI: investment.netRoiEarned,
        },
        walletBalance: wallet.balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Complete investment (Admin only - called when investment matures)
exports.completeInvestment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const investment = await Investment.findById(id).populate('product user');

    if (!investment) {
      return next(new AppError('Investment not found', 404));
    }

    if (investment.status !== 'active') {
      return next(new AppError('Investment is not active', 400));
    }

    if (!investment.isMatured()) {
      return next(new AppError('Investment has not matured yet', 400));
    }

    // Calculate final payout with quantity-based model
    investment.calculateCurrentValue();
    investment.calculateROI();
    const totalPayout = investment.currentValue;

    // Get wallet
    const wallet = await Wallet.findOne({ user: investment.user._id });

    // Credit wallet with current value (principal + ROI)
    await wallet.credit(totalPayout, 'investment_payout');

    // Create transaction record
    const transaction = await Transaction.create({
      user: investment.user._id,
      wallet: wallet._id,
      type: 'roi_payout',
      amount: totalPayout,
      reference: Transaction.generateReference('PAYOUT'),
      status: 'completed',
      description: `Investment maturity payout for ${investment.product.name}`,
      metadata: {
        investmentId: investment._id,
        productId: investment.product._id,
        principal: investment.amount,
        roi: finalROI,
      },
    });

    // Update investment status
    investment.status = 'completed';
    investment.actualROI = investment.currentROI;
    await investment.save();

    // Update product investor count
    const product = await Product.findById(investment.product._id);
    product.investorsCount = Math.max(0, product.investorsCount - 1);
    await product.save();

    // Create notification
    await Notification.create({
      user: investment.user._id,
      type: 'investment_completed',
      title: 'Investment Matured',
      message: `Your investment in ${investment.product?.name || 'product'} has matured. ₦${(totalPayout || 0).toLocaleString()} has been credited to your wallet`,
      metadata: {
        investmentId: investment._id,
        amount: totalPayout,
      },
    });

    // Send email notification
    await emailService.sendInvestmentMaturityNotification(
      investment.user.email,
      investment.user.fullName,
      investment,
      totalPayout
    );

    // Emit wallet update
    emitWalletUpdate(investment.user._id, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    logger.info(
      `Investment completed: ID ${investment._id}, User: ${investment.user.email}, Payout: ₦${totalPayout}`
    );

    res.status(200).json({
      success: true,
      message: 'Investment completed successfully',
      data: {
        investment,
        payout: {
          principal: investment.amount,
          roi: finalROI,
          total: totalPayout,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all investments (Admin only)
exports.getAllInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, productId, userId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (productId) query.product = productId;
    if (userId) query.user = userId;

    const skip = (page - 1) * limit;

    const [investments, total] = await Promise.all([
      Investment.find(query)
        .populate('user', 'fullName email phoneNumber')
        .populate('product', 'name category duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Investment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        investments,
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

// Auto-complete matured investments (Cron job endpoint)
exports.autoCompleteMaturedInvestments = async (req, res, next) => {
  try {
    // Find all matured investments
    const maturedInvestments = await Investment.find({
      status: 'active',
      maturityDate: { $lte: new Date() },
    }).populate('product user');

    let completedCount = 0;
    const errors = [];

    for (const investment of maturedInvestments) {
      try {
        const finalROI = investment.calculateROIEarned();
        const totalPayout = investment.amount + finalROI;

        const wallet = await Wallet.findOne({ user: investment.user._id });
        await wallet.credit(totalPayout, 'investment_payout');

        await Transaction.create({
          user: investment.user._id,
          wallet: wallet._id,
          type: 'roi_payout',
          amount: totalPayout,
          reference: Transaction.generateReference('PAYOUT'),
          status: 'completed',
          description: `Investment maturity payout for ${investment.product.name}`,
          metadata: {
            investmentId: investment._id,
            productId: investment.product._id,
            principal: investment.amount,
            roi: finalROI,
          },
        });

        investment.status = 'completed';
        investment.actualROI = investment.currentROI;
        await investment.save();

        const product = await Product.findById(investment.product._id);
        product.investorsCount = Math.max(0, product.investorsCount - 1);
        await product.save();

        await Notification.create({
          user: investment.user._id,
          type: 'investment_completed',
          title: 'Investment Matured',
          message: `Your investment in ${investment.product?.name || 'product'} has matured. ₦${(totalPayout || 0).toLocaleString()} has been credited to your wallet`,
          metadata: {
            investmentId: investment._id,
            amount: totalPayout,
          },
        });

        await emailService.sendInvestmentMaturityNotification(
          investment.user.email,
          investment.user.fullName,
          investment,
          totalPayout
        );

        emitWalletUpdate(investment.user._id, {
          balance: wallet.balance,
        });

        completedCount++;
        logger.info(`Auto-completed investment: ${investment._id}`);
      } catch (error) {
        logger.error(`Error auto-completing investment ${investment._id}:`, error);
        errors.push({ investmentId: investment._id, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Auto-completed ${completedCount} matured investments`,
      data: {
        completed: completedCount,
        total: maturedInvestments.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};
