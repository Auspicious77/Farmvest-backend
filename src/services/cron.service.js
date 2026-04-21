const cron = require('node-cron');
const investmentController = require('../controllers/investment.controller');
const recommendationService = require('./recommendation.service');
const logger = require('../utils/logger');

// Initialize all cron jobs
exports.initializeCronJobs = () => {
  // Auto-complete matured investments (runs daily at 1:00 AM)
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('Running auto-complete matured investments cron job');
      
      // Call the auto-complete function
      const Investment = require('../models/Investment');
      const Wallet = require('../models/Wallet');
      const Transaction = require('../models/Transaction');
      const Notification = require('../models/Notification');
      const Product = require('../models/Product');
      const emailService = require('./email.service');
      const { emitWalletUpdate } = require('../sockets/performance.socket');
      
      const maturedInvestments = await Investment.find({
        status: 'active',
        maturityDate: { $lte: new Date() },
      }).populate('product user');

      let completedCount = 0;

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
          product.currentInvestors = Math.max(0, product.currentInvestors - 1);
          await product.save();

          await Notification.create({
            user: investment.user._id,
            type: 'investment_completed',
            title: 'Investment Matured',
            message: `Your investment in ${investment.product.name} has matured. ₦${(totalPayout || 0).toLocaleString()} has been credited to your wallet`,
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
        }
      }

      logger.info(`Auto-complete cron job completed: ${completedCount} investments processed`);
    } catch (error) {
      logger.error('Error in auto-complete cron job:', error);
    }
  });

  // Refresh recommendations (runs daily at 2:00 AM)
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('Running recommendation refresh cron job');
      const result = await recommendationService.refreshAllRecommendations();
      logger.info(
        `Recommendation refresh completed: ${result.successCount} successful, ${result.errorCount} errors`
      );
    } catch (error) {
      logger.error('Error in recommendation refresh cron job:', error);
    }
  });

  // Send investment reminders for upcoming maturities (runs daily at 9:00 AM)
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Running investment maturity reminder cron job');
      
      const Investment = require('../models/Investment');
      const Notification = require('../models/Notification');
      const emailService = require('./email.service');

      // Find investments maturing in 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const eightDaysFromNow = new Date();
      eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

      const upcomingMaturities = await Investment.find({
        status: 'active',
        maturityDate: {
          $gte: sevenDaysFromNow,
          $lt: eightDaysFromNow,
        },
      }).populate('product user');

      for (const investment of upcomingMaturities) {
        try {
          await Notification.create({
            user: investment.user._id,
            type: 'investment_reminder',
            title: 'Investment Maturing Soon',
            message: `Your investment in ${investment.product.name} will mature in 7 days`,
            metadata: {
              investmentId: investment._id,
              maturityDate: investment.maturityDate,
            },
          });

          // TODO: Send email reminder
          logger.info(`Sent maturity reminder for investment ${investment._id}`);
        } catch (error) {
          logger.error(`Error sending reminder for investment ${investment._id}:`, error);
        }
      }

      logger.info(`Sent ${upcomingMaturities.length} maturity reminders`);
    } catch (error) {
      logger.error('Error in maturity reminder cron job:', error);
    }
  });

  // Clean up old notifications (runs weekly on Sunday at 3:00 AM)
  cron.schedule('0 3 * * 0', async () => {
    try {
      logger.info('Running notification cleanup cron job');
      
      const Notification = require('../models/Notification');

      // Delete read notifications older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Notification.deleteMany({
        isRead: true,
        readAt: { $lt: thirtyDaysAgo },
      });

      logger.info(`Deleted ${result.deletedCount} old notifications`);
    } catch (error) {
      logger.error('Error in notification cleanup cron job:', error);
    }
  });

  logger.info('✅ Cron jobs initialized successfully');
};
