const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');
const { emitWalletUpdate } = require('../sockets/performance.socket');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// Paystack webhook handler
exports.paystackWebhook = async (req, res, next) => {
  try {
    // Verify Paystack signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { event, data } = req.body;

    logger.info(`Paystack webhook received: ${event}`, { reference: data.reference });

    switch (event) {
      case 'charge.success':
        await handlePaystackChargeSuccess(data);
        break;

      case 'transfer.success':
        await handlePaystackTransferSuccess(data);
        break;

      case 'transfer.failed':
        await handlePaystackTransferFailed(data);
        break;

      default:
        logger.info(`Unhandled Paystack event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    next(error);
  }
};

// Handle successful Paystack charge
async function handlePaystackChargeSuccess(data) {
  try {
    const { reference, amount, metadata } = data;

    // Find transaction
    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      logger.warn(`Transaction not found for reference: ${reference}`);
      return;
    }

    if (transaction.status === 'successful') {
      logger.info(`Transaction already completed: ${reference}`);
      return;
    }

    // Verify amount (Paystack sends in kobo)
    const amountInNaira = amount / 100;
    if (amountInNaira !== transaction.amount) {
      logger.error(`Amount mismatch for ${reference}. Expected: ${transaction.amount}, Got: ${amountInNaira}`);
      transaction.status = 'failed';
      transaction.metadata = { ...transaction.metadata, error: 'Amount mismatch' };
      await transaction.save();
      return;
    }

    // Credit wallet
    const wallet = await Wallet.findById(transaction.wallet);
    await wallet.credit(transaction.amount, 'funding');

    // Update transaction
    transaction.status = 'successful';
    transaction.completedAt = new Date();
    transaction.metadata = { ...transaction.metadata, paystackData: data };
    await transaction.save();

    // Get user
    const user = await User.findById(transaction.user);

    // Send notification
    await emailService.sendTransactionNotification(
      user.email,
      user.fullName,
      'Wallet Funded Successfully',
      `Your wallet has been credited with ₦${(transaction.amount || 0).toLocaleString()}`,
      transaction
    );

    // Emit wallet update
    emitWalletUpdate(transaction.user, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    logger.info(`Wallet funded successfully: ${reference}, Amount: ₦${transaction.amount}`);
  } catch (error) {
    logger.error('Error handling Paystack charge success:', error);
    throw error;
  }
}

// Handle successful Paystack transfer
async function handlePaystackTransferSuccess(data) {
  try {
    const { reference } = data;

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      logger.warn(`Transaction not found for transfer reference: ${reference}`);
      return;
    }

    if (transaction.status === 'successful') {
      logger.info(`Transfer already completed: ${reference}`);
      return;
    }

    // Update transaction
    transaction.status = 'successful';
    transaction.completedAt = new Date();
    transaction.metadata = { ...transaction.metadata, paystackData: data };
    await transaction.save();

    // Get user
    const user = await User.findById(transaction.user);

    // Send notification
    await emailService.sendTransactionNotification(
      user.email,
      user.fullName,
      'Withdrawal Successful',
      `₦${(transaction.amount || 0).toLocaleString()} has been transferred to your bank account`,
      transaction
    );

    logger.info(`Withdrawal completed successfully: ${reference}, Amount: ₦${transaction.amount}`);
  } catch (error) {
    logger.error('Error handling Paystack transfer success:', error);
    throw error;
  }
}

// Handle failed Paystack transfer
async function handlePaystackTransferFailed(data) {
  try {
    const { reference } = data;

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      logger.warn(`Transaction not found for failed transfer: ${reference}`);
      return;
    }

    // Refund wallet
    const wallet = await Wallet.findById(transaction.wallet);
    await wallet.credit(transaction.amount, 'refund');

    // Update transaction
    transaction.status = 'failed';
    transaction.metadata = { ...transaction.metadata, paystackData: data };
    await transaction.save();

    // Get user
    const user = await User.findById(transaction.user);

    // Send notification
    await emailService.sendTransactionNotification(
      user.email,
      user.fullName,
      'Withdrawal Failed',
      `Your withdrawal of ₦${(transaction.amount || 0).toLocaleString()} failed. Amount has been refunded to your wallet`,
      transaction
    );

    // Emit wallet update
    emitWalletUpdate(transaction.user, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    logger.info(`Withdrawal failed and refunded: ${reference}, Amount: ₦${transaction.amount}`);
  } catch (error) {
    logger.error('Error handling Paystack transfer failure:', error);
    throw error;
  }
}

// Monnify webhook handler
exports.monnifyWebhook = async (req, res, next) => {
  try {
    // Verify Monnify signature (implement based on Monnify docs)
    const signature = req.headers['monnify-signature'];
    // TODO: Verify signature

    const { eventType, eventData } = req.body;

    logger.info(`Monnify webhook received: ${eventType}`, { transactionReference: eventData.transactionReference });

    switch (eventType) {
      case 'SUCCESSFUL_TRANSACTION':
        await handleMonnifySuccessfulTransaction(eventData);
        break;

      case 'FAILED_TRANSACTION':
        await handleMonnifyFailedTransaction(eventData);
        break;

      default:
        logger.info(`Unhandled Monnify event: ${eventType}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Monnify webhook error:', error);
    next(error);
  }
};

// Handle successful Monnify transaction (virtual account credit)
async function handleMonnifySuccessfulTransaction(data) {
  try {
    const { transactionReference, amountPaid, paidOn, accountNumber, accountName } = data;

    // Find wallet by virtual account number
    const wallet = await Wallet.findOne({
      'virtualAccount.accountNumber': accountNumber,
    });

    if (!wallet) {
      logger.warn(`Wallet not found for account: ${accountNumber}`);
      return;
    }

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      'metadata.monnifyReference': transactionReference,
    });

    if (existingTransaction) {
      logger.info(`Transaction already processed: ${transactionReference}`);
      return;
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: wallet.user,
      wallet: wallet._id,
      type: 'funding',
      amount: amountPaid,
      paymentMethod: 'bank_transfer',
      paymentProvider: 'monnify',
      reference: Transaction.generateReference('FUND'),
      status: 'completed',
      description: `Wallet funding via bank transfer from ${accountName}`,
      metadata: {
        monnifyReference: transactionReference,
        paidOn,
        accountName,
      },
    });

    // Credit wallet
    await wallet.credit(amountPaid, 'funding');

    // Get user
    const user = await User.findById(wallet.user);

    // Send notification
    await emailService.sendTransactionNotification(
      user.email,
      user.fullName,
      'Wallet Funded Successfully',
      `Your wallet has been credited with ₦${(amountPaid || 0).toLocaleString()} from bank transfer`,
      transaction
    );

    // Emit wallet update
    emitWalletUpdate(wallet.user, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    logger.info(`Wallet funded via Monnify: ${transactionReference}, Amount: ₦${amountPaid}`);
  } catch (error) {
    logger.error('Error handling Monnify successful transaction:', error);
    throw error;
  }
}

// Handle failed Monnify transaction
async function handleMonnifyFailedTransaction(data) {
  try {
    const { transactionReference, accountNumber } = data;

    logger.warn(`Monnify transaction failed: ${transactionReference} for account ${accountNumber}`);
    // Handle failure if needed
  } catch (error) {
    logger.error('Error handling Monnify failed transaction:', error);
    throw error;
  }
}

// PalmPay webhook handler (placeholder)
exports.palmpayWebhook = async (req, res, next) => {
  try {
    // TODO: Implement PalmPay webhook
    logger.info('PalmPay webhook received', req.body);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('PalmPay webhook error:', error);
    next(error);
  }
};
