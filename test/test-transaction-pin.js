const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

// Test credentials - using pre-verified user
const testUser = {
  email: 'testpin@farminvest.com',
  password: 'Test1234',
  fullName: 'Test Pin User',
  phone: '08012345678'
};

let authToken = '';

async function register() {
  try {
    console.log('📝 Registering test user...');
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ Registration successful');
    console.log('ℹ️  Response:', JSON.stringify(response.data, null, 2));
    // Registration doesn't return a token, need to verify email or login
    return response.data;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log('⚠️  User already exists, trying to login...');
      return login();
    }
    console.error('❌ Registration error:', error.response?.data || error.message);
    throw error;
  }
}

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login successful');
    authToken = response.data.data.token;
    return response.data;
  } catch (error) {
    console.error('❌ Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function setTransactionPin(pin) {
  try {
    console.log('\n🔑 Testing set-transaction-pin endpoint...');
    console.log('PIN:', pin);
    console.log('Auth Token:', authToken ? '✅ Present' : '❌ Missing');
    
    const response = await axios.post(
      `${BASE_URL}/users/set-transaction-pin`,
      { pin },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Set transaction PIN successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Set transaction PIN error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

async function testTransactionPin() {
  try {
    // Step 1: Register (if new) or login (if exists)
    const regResult = await register();
    
    // If registration was successful but no token, login
    if (!authToken) {
      console.log('ℹ️  No token from registration, logging in...');
      await login();
    }
    
    // Step 2: Set transaction PIN
    await setTransactionPin('123456');
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed');
    process.exit(1);
  }
}

// Run tests
console.log('🚀 Starting transaction PIN tests...\n');
testTransactionPin();
