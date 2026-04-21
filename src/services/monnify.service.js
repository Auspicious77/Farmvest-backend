const axios = require('axios');
const logger = require('../utils/logger');

const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com';
let accessToken = null;
let tokenExpiry = null;

// Get access token
const getAccessToken = async () => {
  try {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
      return accessToken;
    }

    const credentials = Buffer.from(
      `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
    ).toString('base64');

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/api/v1/auth/login`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    if (response.data.requestSuccessful) {
      accessToken = response.data.responseBody.accessToken;
      // Token expires in 1 hour, refresh 5 minutes before
      tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
      return accessToken;
    }

    throw new Error('Failed to authenticate with Monnify');
  } catch (error) {
    logger.error('Monnify authentication error:', error.response?.data || error.message);
    throw new Error('Monnify authentication failed');
  }
};

// Create reserved account (virtual account)
exports.createReservedAccount = async (userData) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`,
      {
        accountReference: `NESTLY-${userData.userId}`,
        accountName: userData.fullName,
        currencyCode: 'NGN',
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        customerEmail: userData.email,
        customerName: userData.fullName,
        getAllAvailableBanks: false,
        preferredBanks: ['035'], // Wema Bank (default for Monnify)
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.requestSuccessful) {
      const account = response.data.responseBody.accounts[0];
      return {
        success: true,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        bankName: account.bankName,
        bankCode: account.bankCode,
        provider: 'monnify',
      };
    }

    return {
      success: false,
      message: 'Failed to create virtual account',
    };
  } catch (error) {
    logger.error('Monnify account creation error:', error.response?.data || error.message);
    throw new Error('Virtual account creation failed');
  }
};

// Get account transactions
exports.getAccountTransactions = async (accountReference) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${MONNIFY_BASE_URL}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=${accountReference}&page=0&size=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.requestSuccessful) {
      return {
        success: true,
        transactions: response.data.responseBody.content,
      };
    }

    return {
      success: false,
      message: 'Failed to fetch transactions',
    };
  } catch (error) {
    logger.error('Monnify transactions error:', error.response?.data || error.message);
    throw new Error('Failed to fetch transactions');
  }
};

// Verify transaction
exports.verifyTransaction = async (transactionReference) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${MONNIFY_BASE_URL}/api/v2/transactions/${transactionReference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.requestSuccessful) {
      const data = response.data.responseBody;
      return {
        success: true,
        verified: data.paymentStatus === 'PAID',
        amount: data.amountPaid,
        reference: data.transactionReference,
        accountNumber: data.accountNumber,
        paidAt: data.paidOn,
      };
    }

    return {
      success: false,
      message: 'Transaction verification failed',
    };
  } catch (error) {
    logger.error('Monnify verification error:', error.response?.data || error.message);
    throw new Error('Transaction verification failed');
  }
};

// Initiate withdrawal
exports.initiateWithdrawal = async (recipientData, amount, reference) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/api/v2/disbursements/single`,
      {
        amount,
        reference,
        narration: 'Wallet withdrawal',
        destinationBankCode: recipientData.bankCode,
        destinationAccountNumber: recipientData.accountNumber,
        currency: 'NGN',
        sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT, // Your business account
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.requestSuccessful) {
      return {
        success: true,
        reference: response.data.responseBody.reference,
        status: response.data.responseBody.status,
      };
    }

    return {
      success: false,
      message: 'Withdrawal initiation failed',
    };
  } catch (error) {
    logger.error('Monnify withdrawal error:', error.response?.data || error.message);
    throw new Error('Withdrawal processing failed');
  }
};
