require('dotenv').config();
const axios = require('axios');
const paystackService = require('../src/services/paystack.service');
const logger = require('../src/utils/logger');

const BASE_URL = 'http://localhost:5001/api/v1';

// Test credentials - replace with actual user token
let authToken = '';

async function testPaystackService() {
  console.log('🧪 Testing Paystack Service Integration\n');
  console.log('======================================\n');

  // Test 1: Check Paystack credentials
  console.log('1️⃣ Testing Paystack API credentials...');
  try {
    const banks = await paystackService.getBanks();
    if (banks.success) {
      console.log(`✅ Paystack API credentials valid`);
      console.log(`   Found ${banks.banks.length} banks\n`);
    } else {
      console.log('❌ Failed to fetch banks from Paystack\n');
    }
  } catch (error) {
    console.log('❌ Paystack API credentials error:', error.message);
    console.log('   Check PAYSTACK_SECRET_KEY in .env file\n');
    return;
  }

  // Test 2: Initialize payment
  console.log('2️⃣ Testing payment initialization...');
  try {
    const testEmail = 'test@example.com';
    const testAmount = 1000; // ₦1,000
    const testReference = `TEST_${Date.now()}`;

    const payment = await paystackService.initializePayment(
      testEmail,
      testAmount,
      testReference,
      { test: true }
    );

    if (payment.success) {
      console.log('✅ Payment initialization successful');
      console.log(`   Authorization URL: ${payment.authorizationUrl}`);
      console.log(`   Reference: ${payment.reference}\n`);
    } else {
      console.log('❌ Payment initialization failed\n');
    }
  } catch (error) {
    console.log('❌ Payment initialization error:', error.message, '\n');
  }

  // Test 3: Resolve account number
  console.log('3️⃣ Testing account resolution...');
  try {
    const result = await paystackService.resolveAccountNumber('0123456789', '058');
    if (result.success) {
      console.log('✅ Account resolution successful');
      console.log(`   Account Name: ${result.accountName}\n`);
    } else {
      console.log('⚠️  Account resolution failed (this is expected for test accounts)\n');
    }
  } catch (error) {
    console.log('⚠️  Account resolution error (this is expected for test accounts)\n');
  }

  console.log('======================================\n');
}

async function testWalletEndpoints() {
  if (!authToken) {
    console.log('\n⚠️  Skipping wallet endpoint tests (no auth token)');
    console.log('   To test wallet endpoints, login first and set authToken in this script\n');
    return;
  }

  console.log('🧪 Testing Wallet API Endpoints\n');
  console.log('======================================\n');

  // Test 1: Get wallet
  console.log('1️⃣ Testing GET /wallet...');
  try {
    const response = await axios.get(`${BASE_URL}/wallet`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log('✅ Wallet fetched successfully');
    console.log(`   Balance: ₦${response.data.data.wallet.balance}\n`);
  } catch (error) {
    console.log('❌ Wallet fetch error:', error.response?.data?.message || error.message, '\n');
  }

  // Test 2: Initialize funding
  console.log('2️⃣ Testing POST /wallet/fund/paystack...');
  try {
    const response = await axios.post(
      `${BASE_URL}/wallet/fund/paystack`,
      { amount: 5000 },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Funding initialized successfully');
    console.log(`   Authorization URL: ${response.data.data.authorizationUrl}`);
    console.log(`   Reference: ${response.data.data.reference}\n`);
  } catch (error) {
    console.log('❌ Funding initialization error:', error.response?.data?.message || error.message, '\n');
  }

  // Test 3: Get banks
  console.log('3️⃣ Testing GET /wallet/banks...');
  try {
    const response = await axios.get(`${BASE_URL}/wallet/banks`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log('✅ Banks list fetched successfully');
    console.log(`   Found ${response.data.data.banks.length} banks\n`);
  } catch (error) {
    console.log('❌ Banks list error:', error.response?.data?.message || error.message, '\n');
  }

  console.log('======================================\n');
}

async function runTests() {
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('   PAYSTACK INTEGRATION TEST SUITE');
  console.log('═══════════════════════════════════════');
  console.log('\n');

  // Check environment variables
  console.log('📋 Configuration Check:');
  console.log(`   PAYSTACK_SECRET_KEY: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   PAYSTACK_PUBLIC_KEY: ${process.env.PAYSTACK_PUBLIC_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log('\n');

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.log('❌ PAYSTACK_SECRET_KEY not found in .env file');
    console.log('   Please add your Paystack secret key to backend/.env\n');
    process.exit(1);
  }

  await testPaystackService();
  await testWalletEndpoints();

  console.log('═══════════════════════════════════════');
  console.log('   TEST SUITE COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log('\n');
  console.log('📝 Next Steps:');
  console.log('   1. Test in mobile app (Wallet > Fund Wallet > Paystack)');
  console.log('   2. Use Paystack test card: 4084 0840 8408 4081');
  console.log('   3. Monitor webhook at: /api/v1/webhooks/paystack');
  console.log('   4. Check transaction status in database');
  console.log('\n');
}

runTests();
