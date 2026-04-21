const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');
const { generateReference } = require('../utils/helpers.util');
const paystackService = require('../services/paystack.service');
const monnifyService = require('../services/monnify.service');
const { emitWalletUpdate } = require('../sockets/performance.socket');
const logger = require('../utils/logger');

// Get wallet
exports.getWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = await Wallet.create({ user: req.user._id });
    }

    // Create virtual account if doesn't exist
    if (!wallet.virtualAccount || !wallet.virtualAccount.accountNumber) {
      try {
        const virtualAccount = await paystackService.createDedicatedVirtualAccount({
          userId: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: req.user.phone,
        });

        if (virtualAccount.success) {
          wallet.virtualAccount = {
            accountNumber: virtualAccount.accountNumber,
            accountName: virtualAccount.accountName,
            bankName: virtualAccount.bankName,
            provider: 'paystack',
          };
          await wallet.save();
          logger.info(`Virtual account created for user ${req.user._id}: ${virtualAccount.accountNumber}`);
        }
      } catch (error) {
        logger.error('Failed to create virtual account:', error);
        // Continue without virtual account
      }
    }

    res.status(200).json({
      success: true,
      data: {
        wallet,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Fund wallet via bank transfer (get virtual account details)
exports.fundViaBankTransfer = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Create virtual account if doesn't exist
    if (!wallet.virtualAccount || !wallet.virtualAccount.accountNumber) {
      const virtualAccount = await paystackService.createDedicatedVirtualAccount({
        userId: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
      });

      if (virtualAccount.success) {
        wallet.virtualAccount = {
          accountNumber: virtualAccount.accountNumber,
          accountName: virtualAccount.accountName,
          bankName: virtualAccount.bankName,
          provider: 'paystack',
        };
        await wallet.save();
      } else {
        return next(new AppError('Failed to generate virtual account', 500));
      }
    }

    res.status(200).json({
      success: true,
      message: 'Transfer to this account to fund your wallet',
      data: {
        virtualAccount: wallet.virtualAccount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Fund wallet via Paystack
exports.fundViaPaystack = async (req, res, next) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 100) {
      return next(new AppError('Minimum funding amount is ₦100', 400));
    }

    // Check wallet tier limit
    const user = await User.findById(req.user._id);
    const maxLimit = user.walletTier === 'verified' ? 10000000 : 100000;
    
    if (amount > maxLimit) {
      return next(new AppError(`Maximum funding amount for ${user.walletTier} tier is ₦${(maxLimit || 0).toLocaleString()}`, 400));
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    const reference = Transaction.generateReference('FUND');

    // Create pending transaction
    const transaction = await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: 'funding',
      amount,
      paymentMethod: 'paystack',
      paymentProvider: 'paystack',
      reference,
      status: 'pending',
      description: 'Wallet funding via Paystack',
    });

    // Initialize Paystack payment
    const payment = await paystackService.initializePayment(
      req.user.email,
      amount,
      reference,
      {
        userId: req.user._id.toString(),
        transactionId: transaction._id.toString(),
        type: 'wallet_funding',
      }
    );

    if (!payment.success) {
      transaction.status = 'failed';
      await transaction.save();
      return next(new AppError('Payment initialization failed', 500));
    }

    res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorizationUrl: payment.authorizationUrl,
        reference: payment.reference,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify Paystack payment
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return next(new AppError('Payment reference is required', 400));
    }

    logger.info(`Verifying payment for reference: ${reference}, User: ${req.user._id}`);

    // Find transaction first
    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      logger.warn(`Transaction not found for reference: ${reference}`);
      return next(new AppError('Transaction not found. Please ensure you initiated a payment.', 404));
    }

    // Check if already completed
    if (transaction.status === 'successful') {
      logger.info(`Payment already verified: ${reference}`);
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: { transaction },
      });
    }

    // Verify payment with Paystack
    const verification = await paystackService.verifyPayment(reference);

    logger.info(`Verification result:`, { 
      success: verification.success, 
      verified: verification.verified,
      status: verification.status 
    });

    if (!verification.success) {
      logger.error(`Paystack verification failed: ${verification.message || 'Unknown error'}`);
      return next(new AppError(verification.message || 'Payment verification failed', 400));
    }

    if (!verification.verified) {
      const statusMessage = verification.status || 'not successful';
      logger.warn(`Payment not verified. Status: ${statusMessage}`);
      return next(new AppError(`Payment ${statusMessage}. Please complete the payment and try again.`, 400));
    }

    // Update transaction and credit wallet
    const wallet = await Wallet.findById(transaction.wallet);
    
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    await wallet.credit(transaction.amount, 'funding');

    transaction.status = 'successful';
    transaction.completedAt = new Date();
    transaction.metadata = {
      ...transaction.metadata,
      verifiedAt: new Date(),
      paystackData: verification,
    };
    await transaction.save();

    logger.info(`Payment verified successfully: ${reference}, Amount: ₦${transaction.amount}`);

    // Emit wallet update
    emitWalletUpdate(transaction.user, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { 
        transaction,
        newBalance: wallet.balance 
      },
    });
  } catch (error) {
    logger.error('Verify payment error:', error);
    next(error);
  }
};

// Fund wallet via PalmPay (placeholder)
exports.fundViaPalmPay = async (req, res, next) => {
  try {
    // TODO: Implement PalmPay integration
    res.status(501).json({
      success: false,
      message: 'PalmPay integration coming soon',
    });
  } catch (error) {
    next(error);
  }
};

// Withdraw from wallet
exports.withdraw = async (req, res, next) => {
  try {
    const { amount, pin } = req.body;

    // Validate amount
    if (!amount || amount < 100) {
      return next(new AppError('Minimum withdrawal amount is ₦100', 400));
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Check if primary account is set
    if (!wallet.primaryAccount || !wallet.primaryAccount.accountNumber) {
      return next(new AppError('Please set up your primary bank account first', 400));
    }

    // Check balance
    if (!wallet.hasSufficientBalance(amount)) {
      return next(new AppError('Insufficient wallet balance', 400));
    }

    // Verify transaction PIN
    const user = await User.findById(req.user._id).select('+transactionPin');
    
    if (!user.transactionPin) {
      return next(new AppError('Please set up your transaction PIN first', 400));
    }

    const isPinValid = await user.compareTransactionPin(pin);
    if (!isPinValid) {
      return next(new AppError('Invalid transaction PIN', 400));
    }

    const reference = Transaction.generateReference('WITH');

    // Create pending transaction
    const transaction = await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: 'withdrawal',
      amount,
      paymentMethod: 'bank_transfer',
      paymentProvider: 'paystack',
      reference,
      status: 'pending',
      destinationAccount: wallet.primaryAccount,
      description: 'Wallet withdrawal',
    });

    // Debit wallet
    await wallet.debit(amount, 'withdrawal');

    // Emit wallet update
    emitWalletUpdate(req.user._id, {
      balance: wallet.balance,
      lastTransaction: transaction,
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted. Processing may take 1-24 hours',
      data: {
        transaction,
        newBalance: wallet.balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get wallet transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    const query = { wallet: wallet._id };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
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

// Get transaction by ID
exports.getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    
    const transaction = await Transaction.findOne({
      _id: id,
      wallet: wallet._id,
    });

    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's bank accounts
exports.getBankAccounts = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: {
          banks: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        banks: wallet.bankAccounts || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add bank account
exports.addBankAccount = async (req, res, next) => {
  try {
    const { bankCode, accountNumber } = req.body;

    if (!bankCode || !accountNumber) {
      return next(new AppError('Bank code and account number are required', 400));
    }

    // Verify account with Paystack
    const verification = await paystackService.resolveAccountNumber(accountNumber, bankCode);

    if (!verification.success) {
      return next(new AppError('Failed to verify bank account', 400));
    }

    // Get bank name
    const banksResult = await paystackService.getBanks();
    const bank = banksResult.banks?.find(b => b.code === bankCode);

    let wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id });
    }

    // Check if account already exists
    const existingAccount = wallet.bankAccounts.find(
      acc => acc.accountNumber === accountNumber && acc.bankCode === bankCode
    );

    if (existingAccount) {
      return next(new AppError('Bank account already added', 400));
    }

    // If this is the first account, make it primary
    const isPrimary = wallet.bankAccounts.length === 0;

    // Add new bank account
    wallet.bankAccounts.push({
      accountNumber,
      accountName: verification.accountName,
      bankCode,
      bankName: bank?.name || 'Unknown Bank',
      isPrimary,
    });

    await wallet.save();

    const addedAccount = wallet.bankAccounts[wallet.bankAccounts.length - 1];

    res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      data: {
        bank: addedAccount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Set primary bank account
exports.setPrimaryBankAccount = async (req, res, next) => {
  try {
    const { bankId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Find the bank account
    const bankAccount = wallet.bankAccounts.id(bankId);

    if (!bankAccount) {
      return next(new AppError('Bank account not found', 404));
    }

    // Set all accounts to not primary
    wallet.bankAccounts.forEach(acc => {
      acc.isPrimary = false;
    });

    // Set the selected account as primary
    bankAccount.isPrimary = true;

    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Primary bank account updated',
    });
  } catch (error) {
    next(error);
  }
};

// Delete bank account
exports.deleteBankAccount = async (req, res, next) => {
  try {
    const { bankId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }

    // Find the bank account
    const bankAccount = wallet.bankAccounts.id(bankId);

    if (!bankAccount) {
      return next(new AppError('Bank account not found', 404));
    }

    // Don't allow deleting the last account if there are pending withdrawals
    if (wallet.bankAccounts.length === 1) {
      // You can add additional checks here if needed
    }

    // Remove the account
    bankAccount.remove();

    // If the deleted account was primary and there are other accounts, make the first one primary
    if (bankAccount.isPrimary && wallet.bankAccounts.length > 0) {
      wallet.bankAccounts[0].isPrimary = true;
    }

    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Bank account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get banks list
exports.getBanksList = async (req, res, next) => {
  try {
    const result = await paystackService.getBanks();

    res.status(200).json({
      success: true,
      data: {
        banks: result.banks || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Resolve account number
exports.resolveAccountNumber = async (req, res, next) => {
  try {
    const { accountNumber, bankCode } = req.query;

    if (!accountNumber || !bankCode) {
      return next(new AppError('Account number and bank code are required', 400));
    }

    const result = await paystackService.resolveAccountNumber(accountNumber, bankCode);

    if (!result.success) {
      return next(new AppError('Failed to resolve account number', 400));
    }

    res.status(200).json({
      success: true,
      data: {
        accountName: result.accountName,
        accountNumber: result.accountNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};
