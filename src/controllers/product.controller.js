const Product = require('../models/Product');
const Investment = require('../models/Investment');
const Revenue = require('../models/Revenue');
const { AppError } = require('../middleware/error.middleware');
const { uploadToS3 } = require('../utils/helpers.util');
const { emitPerformanceUpdate } = require('../sockets/performance.socket');
const logger = require('../utils/logger');

// Get all products
exports.getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, status, search } = req.query;

    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    // Enrich products with statistics
    const enrichedProducts = await Promise.all(
      products.map(async (product) => {
        const [investorsCount, totalInvestedResult] = await Promise.all([
          Investment.countDocuments({ 
            product: product._id, 
            status: { $in: ['active', 'completed'] } 
          }),
          Investment.aggregate([
            { 
              $match: { 
                product: product._id, 
                status: { $in: ['active', 'completed'] } 
              } 
            },
            { $group: { _id: null, total: { $sum: '$totalInvestment' } } }
          ])
        ]);

        const totalInvested = totalInvestedResult[0]?.total || 0;
        
        // Calculate investment range based on unit price and quantity range
        const minInvestment = (product.unitPrice || 0) * (product.minQuantity || 0);
        const maxInvestment = (product.unitPrice || 0) * (product.maxQuantity || 0);

        return {
          ...product.toObject(),
          investorsCount: investorsCount || 0,
          currentInvestors: investorsCount || 0,
          totalInvested: totalInvested || 0,
          minInvestment: minInvestment || 0,
          maxInvestment: maxInvestment || 0,
          currentROI: product.currentROI || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedProducts,
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

// Get featured products
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      status: 'open',
      isFeatured: true,
    })
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
// exports.getProductById = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const product = await Product.findById(id);

//     if (!product) {
//       return next(new AppError('Product not found', 404));
//     }

//     // Get additional statistics
//     const investorsCount = await Investment.countDocuments({ 
//       product: id, 
//       status: { $in: ['active', 'completed'] } 
//     });

//     const totalInvestedResult = await Investment.aggregate([
//       { 
//         $match: { 
//           product: product._id, 
//           status: { $in: ['active', 'completed'] } 
//         } 
//       },
//       { $group: { _id: null, total: { $sum: '$amount' } } }
//     ]);

//     const totalInvested = totalInvestedResult[0]?.total || 0;

//     // Merge product with statistics
//     const productWithStats = {
//       ...product.toObject(),
//       investorsCount: investorsCount || product.investorsCount || 0,
//       totalInvested: totalInvested || product.totalInvested || 0,
//     };

//     res.status(200).json({
//       success: true,
//       data: productWithStats,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate product ID
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return next(new AppError('Invalid product ID format', 400));
    }

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Get additional statistics
    const [investorsCount, totalInvestedResult] = await Promise.all([
      Investment.countDocuments({ 
        product: id, 
        status: { $in: ['active', 'completed'] } 
      }),
      Investment.aggregate([
        { 
          $match: { 
            product: product._id, 
            status: { $in: ['active', 'completed'] } 
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalInvestment' } } }
      ])
    ]);

    const totalInvested = totalInvestedResult[0]?.total || 0;
    
    // Calculate investment range based on unit price and quantity range
    const minInvestment = (product.unitPrice || 0) * (product.minQuantity || 0);
    const maxInvestment = (product.unitPrice || 0) * (product.maxQuantity || 0);
    const availableSlots = product.maxInvestors - investorsCount;
    const investmentProgress = (investorsCount / product.maxInvestors) * 100;

    // Merge product with statistics
    const productWithStats = {
      ...product.toObject(),
      investorsCount: investorsCount || 0,
      currentInvestors: investorsCount || 0,
      totalInvested: totalInvested || 0,
      minInvestment: minInvestment || 0,
      maxInvestment: maxInvestment || 0,
      currentROI: product.currentROI || 0,
      maxInvestors: product.maxInvestors || 100,
      availableSlots: Math.max(0, availableSlots),
      investmentProgress: Math.min(100, investmentProgress),
      canInvest: product.status === 'open' && availableSlots > 0
    };

    res.status(200).json({
      success: true,
      data: productWithStats,
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    next(error);
  }
};

// Get product performance history
exports.getProductPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Get performance data for last N days
    const numDays = parseInt(days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - numDays);

    let performanceHistory = (product.priceHistory || []).filter(
      (entry) => new Date(entry.date) >= cutoffDate
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    // ALWAYS include the base unit price as the starting point if it's not already there
    // or if the first entry's price doesn't match the base price
    const shouldPrependBasePrice = performanceHistory.length === 0 || 
      performanceHistory[0].price !== product.unitPrice;

    if (shouldPrependBasePrice) {
      // Add base price as the first data point (at product creation or cutoff date)
      const baseDate = performanceHistory.length > 0 
        ? cutoffDate 
        : (product.createdAt || new Date());
      
      performanceHistory.unshift({
        date: baseDate,
        price: product.unitPrice,
        percentageChange: 0,
      });
    }

    // If still no data after adding base price, ensure at least one point exists
    if (performanceHistory.length === 0) {
      performanceHistory = [{
        date: product.createdAt || new Date(),
        price: product.unitPrice,
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
        // 1 month: Show month/day (Dec 01)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // 3M, 6M, 1Y: Show month (Jan, Feb)
        return d.toLocaleDateString('en-US', { month: 'short' });
      }
    };

    res.status(200).json({
      success: true,
      data: performanceHistory.map(entry => ({
        date: entry.date,
        dateLabel: formatDate(entry.date, numDays),
        price: entry.price,
        marketValue: entry.price,
        roi: entry.percentageChange || 0,
        percentageChange: entry.percentageChange || 0,
        notes: entry.notes,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Create product (Admin only)
exports.createProduct = async (req, res, next) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id,
    };

    // Handle image upload if file is provided
    if (req.file) {
      // TODO: Implement S3 upload
      // productData.image = await uploadToS3(req.file);
      productData.image = req.file.path; // For now, use local path
    }

    const product = await Product.create(productData);

    logger.info(`Product created: ${product.name} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    let product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Handle image upload if file is provided
    if (req.file) {
      // TODO: Implement S3 upload
      // req.body.image = await uploadToS3(req.file);
      req.body.image = req.file.path;
    }

    product = await Product.findByIdAndUpdate(
      id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    logger.info(`Product updated: ${product.name} by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product performance (Admin only - Critical daily task)
// Now updates price instead of ROI, calculates percentage change
exports.updateProductPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price, notes } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (!price || price < 0) {
      return next(new AppError('Valid price is required', 400));
    }

    // Calculate percentage change from original unit price (base price)
    // unitPrice remains constant as the original listing price
    // currentPrice is updated to reflect current market value
    const percentageChange = ((price - product.unitPrice) / product.unitPrice) * 100;

    // Add new price history entry
    product.priceHistory.push({
      date: new Date(),
      price,
      percentageChange,
      notes,
    });

    // Update current market price (NOT the base unitPrice)
    // New investors will pay this currentPrice
    // Existing investors' ROI is calculated based on their entry price vs this currentPrice
    product.currentPrice = price;

    // Keep only last 365 days of price history
    if (product.priceHistory.length > 365) {
      product.priceHistory = product.priceHistory.slice(-365);
    }

    await product.save();

    // Update all active investments for this product
    const activeInvestments = await Investment.find({
      product: product._id,
      status: 'active',
    });

    let totalPlatformRevenue = 0;
    const revenueRecords = [];

    const updatePromises = activeInvestments.map(async (investment) => {
      // Store previous values for revenue tracking
      const previousPrice = investment.currentUnitPrice;
      const previousValue = investment.currentValue;
      
      // Update investment with new price
      investment.currentUnitPrice = price;
      investment.calculateCurrentValue();
      investment.calculateROI();

      // Calculate platform revenue from this update
      // Platform gets 20% of the ROI increase
      const grossROI = (investment.quantity * price) - investment.totalInvestment;
      const platformFeeFromUpdate = grossROI > 0 ? investment.platformFee : 0;
      
      // Only track revenue if there's actual profit
      if (platformFeeFromUpdate > 0 && price > previousPrice) {
        totalPlatformRevenue += platformFeeFromUpdate;
        
        // Create revenue record
        revenueRecords.push({
          product: product._id,
          investment: investment._id,
          user: investment.user,
          amount: platformFeeFromUpdate,
          previousPrice,
          newPrice: price,
          priceChangePercent: percentageChange,
          investmentQuantity: investment.quantity,
          investmentBasePrice: investment.unitPrice,
          grossROI,
          date: new Date(),
          notes: notes || `Price update from ₦${(previousPrice || 0).toLocaleString()} to ₦${(price || 0).toLocaleString()}`,
        });
      }

      // Add price snapshot for candlestick charts
      investment.priceSnapshots.push({
        date: new Date(),
        price,
        value: investment.currentValue,
        percentageChange: investment.roiPercentage,
      });

      // Keep only last 365 days
      if (investment.priceSnapshots.length > 365) {
        investment.priceSnapshots = investment.priceSnapshots.slice(-365);
      }

      await investment.save();

      // Emit real-time update to user
      const previousSnapshot = investment.priceSnapshots[investment.priceSnapshots.length - 2];
      const dailyChange = previousSnapshot ? price - previousSnapshot.price : 0;

      emitPerformanceUpdate(investment.user, {
        investmentId: investment._id,
        productId: product._id,
        currentPrice: price,
        currentValue: investment.currentValue,
        roiPercentage: investment.roiPercentage,
        dailyChange,
      });
    });

    await Promise.all(updatePromises);
    
    // Save all revenue records
    if (revenueRecords.length > 0) {
      await Revenue.insertMany(revenueRecords);
    }

    logger.info(
      `Product performance updated: ${product.name}, Price: ₦${price}, Change: ${percentageChange.toFixed(2)}%, ` +
      `Updated ${activeInvestments.length} investments, Platform Revenue: ₦${totalPlatformRevenue.toFixed(2)}`
    );

    // Get updated statistics
    const investorsCount = await Investment.countDocuments({ 
      product: id, 
      status: { $in: ['active', 'completed'] } 
    });

    const totalInvestedResult = await Investment.aggregate([
      { 
        $match: { 
          product: product._id, 
          status: { $in: ['active', 'completed'] } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalInvestment' } } }
    ]);

    const totalInvested = totalInvestedResult[0]?.total || 0;

    // Merge product with updated statistics
    const productWithStats = {
      ...product.toObject(),
      investorsCount: investorsCount || product.investorsCount || 0,
      totalInvested: totalInvested || product.totalInvested || 0,
    };

    res.status(200).json({
      success: true,
      message: 'Product performance updated successfully',
      data: productWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle product status (Admin only)
exports.toggleProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    product.status = product.status === 'open' ? 'closed' : 'open';
    await product.save();

    logger.info(`Product status changed: ${product.name} - ${product.status}`);

    res.status(200).json({
      success: true,
      message: `Product ${product.status === 'open' ? 'opened' : 'closed'} successfully`,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if product has active investments
    const activeInvestments = await Investment.countDocuments({
      product: id,
      status: 'active',
    });

    if (activeInvestments > 0) {
      return next(
        new AppError(
          'Cannot delete product with active investments. Please close all investments first.',
          400
        )
      );
    }

    await product.deleteOne();

    logger.info(`Product deleted: ${product.name} by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get product statistics (Admin only)
exports.getProductStatistics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Get investment statistics
    const [investmentStats] = await Investment.aggregate([
      { $match: { product: product._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const activeInvestments = await Investment.countDocuments({
      product: id,
      status: 'active',
    });

    const totalInvestors = await Investment.distinct('user', { product: id });

    res.status(200).json({
      success: true,
      data: {
        product,
        statistics: {
          totalInvestors: totalInvestors.length,
          activeInvestments,
          investmentStats,
          availableSlots: product.maxInvestors - product.currentInvestors,
          occupancyRate: (product.currentInvestors / product.maxInvestors) * 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload product image
exports.uploadProductImage = async (req, res, next) => {
  try {
    let imageFile;

    // Handle different upload formats
    if (req.files && req.files.image) {
      // express-fileupload format
      imageFile = req.files.image;
    } else if (req.file) {
      // multer format
      imageFile = req.file;
    } else if (req.body.image) {
      // base64 or URL in body
      imageFile = req.body.image;
    } else {
      return next(new AppError('Please upload an image', 400));
    }

    // Validate file type (if it's a file object)
    if (imageFile.mimetype && !imageFile.mimetype.startsWith('image')) {
      return next(new AppError('Please upload an image file', 400));
    }

    // Validate file size (max 5MB) (if it's a file object)
    if (imageFile.size && imageFile.size > 5 * 1024 * 1024) {
      return next(new AppError('Image size must be less than 5MB', 400));
    }

    // Upload to cloud storage (S3/Cloudinary)
    const imageUrl = await uploadToS3(imageFile);

    res.status(200).json({
      success: true,
      data: {
        url: imageUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product status
exports.updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Product status updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product performance
exports.deleteProductPerformance = async (req, res, next) => {
  try {
    const { id, performanceId } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    product.priceHistory = (product.priceHistory || []).filter(
      (p) => p._id.toString() !== performanceId
    );

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Performance record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get product investors
exports.getProductInvestors = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const investments = await Investment.find({ product: id, status: 'active' })
      .populate('user', 'fullName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Investment.countDocuments({ product: id, status: 'active' });

    // Format investors data with amount field
    const investors = investments.map(inv => ({
      ...inv.toObject(),
      amount: inv.totalInvestment || 0,
      user: {
        name: inv.user?.fullName || 'Unknown User',
        email: inv.user?.email || '',
        phone: inv.user?.phone || ''
      }
    }));

    res.status(200).json({
      success: true,
      data: investors,
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

// Bulk activate products
exports.bulkActivateProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    await Product.updateMany({ _id: { $in: productIds } }, { status: 'open' });

    res.status(200).json({
      success: true,
      message: `${productIds.length} products activated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk deactivate products
exports.bulkDeactivateProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    await Product.updateMany({ _id: { $in: productIds } }, { status: 'closed' });

    res.status(200).json({
      success: true,
      message: `${productIds.length} products deactivated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk delete products
exports.bulkDeleteProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    // Check if any products have active investments
    const activeInvestments = await Investment.countDocuments({
      product: { $in: productIds },
      status: 'active',
    });

    if (activeInvestments > 0) {
      return next(
        new AppError('Cannot delete products with active investments', 400)
      );
    }

    await Product.deleteMany({ _id: { $in: productIds } });

    res.status(200).json({
      success: true,
      message: `${productIds.length} products deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Get platform revenue statistics (Admin only)
exports.getRevenueStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate, productId } = req.query;

    const query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    if (productId) query.product = productId;

    // Get total revenue
    const totalRevenueResult = await Revenue.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Get revenue by product
    const revenueByProduct = await Revenue.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$product',
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 },
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          productId: '$_id',
          productName: '$productInfo.name',
          totalRevenue: 1,
          count: 1,
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Get recent revenue records
    const recentRevenue = await Revenue.find(query)
      .sort({ date: -1 })
      .limit(50)
      .populate('product', 'name category')
      .populate('user', 'firstName lastName email')
      .populate('investment', 'quantity totalInvestment currentValue');

    // Get revenue trend (by month)
    const revenueTrend = await Revenue.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        revenueByProduct,
        recentRevenue,
        revenueTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Export products
exports.exportProducts = async (req, res, next) => {
  try {
    const { category, status } = req.query;

    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;

    const products = await Product.find(query);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

