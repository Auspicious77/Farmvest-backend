const axios = require('axios');
const logger = require('../utils/logger');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Initialize payment
exports.initializePayment = async (email, amount, reference, metadata = {}) => {
  try {
    const paymentData = {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      metadata,
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'], // Enable all payment methods
    };

    // Only add callback_url for web clients
    if (metadata.platform === 'web' && process.env.CLIENT_URL) {
      paymentData.callback_url = `${process.env.CLIENT_URL}/wallet/payment-callback`;
    }

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status) {
      return {
        success: true,
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    }

    return {
      success: false,
      message: 'Failed to initialize payment',
    };
  } catch (error) {
    logger.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error('Payment initialization failed');
  }
};

// Verify payment
exports.verifyPayment = async (reference) => {
  try {
    logger.info(`Verifying payment: ${reference}`);
    
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    logger.info(`Paystack response:`, { 
      status: response.data.status, 
      dataStatus: response.data.data?.status,
      amount: response.data.data?.amount 
    });

    if (response.data.status && response.data.data.status === 'success') {
      return {
        success: true,
        verified: true,
        amount: response.data.data.amount / 100, // Convert from kobo
        reference: response.data.data.reference,
        metadata: response.data.data.metadata,
        paidAt: response.data.data.paid_at,
        channel: response.data.data.channel,
        transactionData: response.data.data,
      };
    }

    // Payment exists but not successful
    const paymentStatus = response.data.data?.status || 'unknown';
    logger.warn(`Payment not successful. Status: ${paymentStatus}, Reference: ${reference}`);
    
    return {
      success: true,
      verified: false,
      message: `Payment status: ${paymentStatus}`,
      status: paymentStatus,
    };
  } catch (error) {
    logger.error('Paystack verification error:', {
      message: error.message,
      response: error.response?.data,
      reference
    });
    
    // If transaction not found, it might not have been initiated
    if (error.response?.status === 404) {
      return {
        success: false,
        verified: false,
        message: 'Transaction not found. Payment may not have been initiated.',
      };
    }
    
    throw new Error('Payment verification failed');
  }
};

// Process withdrawal
exports.initiateTransfer = async (recipientData, amount, reference) => {
  try {
    // First, create transfer recipient
    const recipientResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: 'nuban',
        name: recipientData.accountName,
        account_number: recipientData.accountNumber,
        bank_code: recipientData.bankCode,
        currency: 'NGN',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!recipientResponse.data.status) {
      throw new Error('Failed to create transfer recipient');
    }

    const recipientCode = recipientResponse.data.data.recipient_code;

    // Initiate transfer
    const transferResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: 'balance',
        amount: amount * 100, // Convert to kobo
        recipient: recipientCode,
        reference,
        reason: 'Wallet withdrawal',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (transferResponse.data.status) {
      return {
        success: true,
        transferCode: transferResponse.data.data.transfer_code,
        reference: transferResponse.data.data.reference,
        status: transferResponse.data.data.status,
      };
    }

    return {
      success: false,
      message: 'Transfer initiation failed',
    };
  } catch (error) {
    logger.error('Paystack transfer error:', error.response?.data || error.message);
    throw new Error('Withdrawal processing failed');
  }
};

// Verify transfer
exports.verifyTransfer = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transfer/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status) {
      return {
        success: true,
        verified: response.data.data.status === 'success',
        amount: response.data.data.amount / 100,
        reference: response.data.data.reference,
        status: response.data.data.status,
      };
    }

    return {
      success: false,
      message: 'Transfer verification failed',
    };
  } catch (error) {
    logger.error('Paystack transfer verification error:', error.response?.data || error.message);
    throw new Error('Transfer verification failed');
  }
};

// Get banks list
exports.getBanks = async () => {
  try {
    // Fetch all banks - Paystack supports up to 200 per page
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank?currency=NGN&perPage=200`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status && response.data.data) {
      // Map Paystack bank format to our format
      const banks = response.data.data.map(bank => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug,
        longcode: bank.longcode,
        active: bank.active,
      }));

      // Filter only active banks and sort alphabetically
      const activeBanks = banks
        .filter(bank => bank.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));

      logger.info(`Fetched ${activeBanks.length} active banks from Paystack`);

      return {
        success: true,
        banks: activeBanks,
      };
    }

    return {
      success: false,
      message: 'Failed to fetch banks',
    };
  } catch (error) {
    logger.error('Paystack banks list error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch banks list',
      banks: [],
    };
  }
};

// Resolve account number
exports.resolveAccountNumber = async (accountNumber, bankCode) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status) {
      return {
        success: true,
        accountName: response.data.data.account_name,
        accountNumber: response.data.data.account_number,
      };
    }

    return {
      success: false,
      message: 'Account resolution failed',
    };
  } catch (error) {
    logger.error('Paystack account resolution error:', error.response?.data || error.message);
    throw new Error('Account resolution failed');
  }
};

// Create customer
exports.createCustomer = async (userData) => {
  try {
    logger.info(`Creating Paystack customer for user: ${userData.email}`);
    
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/customer`,
      {
        email: userData.email,
        first_name: userData.fullName.split(' ')[0],
        last_name: userData.fullName.split(' ').slice(1).join(' ') || userData.fullName.split(' ')[0],
        phone: userData.phone || '',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status && response.data.data) {
      const customerData = response.data.data;
      logger.info(`Customer created: ${customerData.customer_code}`);
      
      return {
        success: true,
        customerCode: customerData.customer_code,
        customerId: customerData.id,
        email: customerData.email,
      };
    }

    return {
      success: false,
      message: 'Failed to create customer',
    };
  } catch (error) {
    // If customer already exists, try to fetch it
    if (error.response?.data?.message?.includes('already')) {
      try {
        const fetchResponse = await axios.get(
          `${PAYSTACK_BASE_URL}/customer/${userData.email}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        if (fetchResponse.data.status && fetchResponse.data.data) {
          const customerData = fetchResponse.data.data;
          logger.info(`Existing customer found: ${customerData.customer_code}`);
          
          return {
            success: true,
            customerCode: customerData.customer_code,
            customerId: customerData.id,
            email: customerData.email,
          };
        }
      } catch (fetchError) {
        logger.error('Failed to fetch existing customer:', fetchError.message);
      }
    }
    
    logger.error('Paystack customer creation error:', {
      message: error.message,
      response: error.response?.data,
      email: userData.email
    });
    
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create customer',
    };
  }
};

// Create dedicated virtual account (DVA)
exports.createDedicatedVirtualAccount = async (userData) => {
  try {
    logger.info(`Creating Paystack virtual account for user: ${userData.email}`);
    
    // First, ensure customer exists
    const customer = await exports.createCustomer(userData);
    if (!customer.success) {
      return customer;
    }
    
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/dedicated_account`,
      {
        customer: customer.customerCode,
        preferred_bank: 'wema-bank', // or 'titan-paystack'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status && response.data.data) {
      const accountData = response.data.data;
      logger.info(`Virtual account created: ${accountData.account_number}`);
      
      return {
        success: true,
        accountNumber: accountData.account_number,
        accountName: accountData.account_name,
        bankName: accountData.bank.name,
        bankCode: accountData.bank.id.toString(),
        provider: 'paystack',
        accountReference: accountData.id,
      };
    }

    return {
      success: false,
      message: 'Failed to create virtual account',
    };
  } catch (error) {
    logger.error('Paystack virtual account creation error:', {
      message: error.message,
      response: error.response?.data,
      email: userData.email
    });
    
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create virtual account',
    };
  }
};
