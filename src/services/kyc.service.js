const axios = require('axios');
const { encrypt, decrypt } = require('../utils/encryption.util');
const logger = require('../utils/logger');

const SMILE_API_URL = process.env.SMILE_ENV === 'production' 
  ? 'https://api.usesmileid.com/v1' 
  : 'https://sandbox.usesmileid.com/v1';

// Create Smile Identity headers
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'SmileIdentity-Partner-Id': process.env.SMILE_PARTNER_ID,
  'SmileIdentity-Api-Key': process.env.SMILE_API_KEY,
});

// Verify BVN
exports.verifyBVN = async (bvnData) => {
  try {
    const { bvn, firstName, lastName, dateOfBirth } = bvnData;

    const response = await axios.post(
      `${SMILE_API_URL}/id_verification`,
      {
        country: 'NG',
        id_type: 'BVN',
        id_number: bvn,
        first_name: firstName,
        last_name: lastName,
        dob: dateOfBirth, // Format: YYYY-MM-DD
      },
      { headers: getHeaders() }
    );

    if (response.data.success) {
      return {
        success: true,
        verified: response.data.verified,
        data: {
          fullName: response.data.full_name,
          dateOfBirth: response.data.dob,
          phoneNumber: response.data.phone_number,
          gender: response.data.gender,
        },
      };
    }

    return {
      success: false,
      verified: false,
      message: 'BVN verification failed',
    };
  } catch (error) {
    logger.error('BVN verification error:', error.response?.data || error.message);
    throw new Error('BVN verification service unavailable');
  }
};

// Verify NIN
exports.verifyNIN = async (ninData) => {
  try {
    const { nin, firstName, lastName } = ninData;

    const response = await axios.post(
      `${SMILE_API_URL}/id_verification`,
      {
        country: 'NG',
        id_type: 'NIN',
        id_number: nin,
        first_name: firstName,
        last_name: lastName,
      },
      { headers: getHeaders() }
    );

    if (response.data.success) {
      return {
        success: true,
        verified: response.data.verified,
        data: {
          fullName: response.data.full_name,
          dateOfBirth: response.data.dob,
          phoneNumber: response.data.phone_number,
          gender: response.data.gender,
        },
      };
    }

    return {
      success: false,
      verified: false,
      message: 'NIN verification failed',
    };
  } catch (error) {
    logger.error('NIN verification error:', error.response?.data || error.message);
    throw new Error('NIN verification service unavailable');
  }
};

// Mock verification for development/testing
exports.mockVerifyBVN = async (bvnData) => {
  logger.info('Using mock BVN verification');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    verified: true,
    data: {
      fullName: `${bvnData.firstName} ${bvnData.lastName}`,
      dateOfBirth: bvnData.dateOfBirth,
      phoneNumber: '08012345678',
      gender: 'Male',
    },
  };
};

exports.mockVerifyNIN = async (ninData) => {
  logger.info('Using mock NIN verification');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    verified: true,
    data: {
      fullName: `${ninData.firstName} ${ninData.lastName}`,
      dateOfBirth: '1990-01-01',
      phoneNumber: '08012345678',
      gender: 'Male',
    },
  };
};

// Encrypt and store BVN
exports.encryptAndStoreBVN = (bvn) => {
  return encrypt(bvn);
};

// Encrypt and store NIN
exports.encryptAndStoreNIN = (nin) => {
  return encrypt(nin);
};

// Decrypt BVN
exports.decryptBVN = (encryptedBVN) => {
  return decrypt(encryptedBVN);
};

// Decrypt NIN
exports.decryptNIN = (encryptedNIN) => {
  return decrypt(encryptedNIN);
};
