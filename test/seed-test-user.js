require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const logger = require('../src/utils/logger');

const seedTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ MongoDB Connected');

    const testEmail = 'testpin@farminvest.com';

    // Check if test user already exists
    const existingUser = await User.findOne({ email: testEmail });
    
    if (existingUser) {
      logger.info('⚠️  Test user already exists');
      
      // Update user to be verified and remove transaction PIN
      existingUser.isEmailVerified = true;
      existingUser.isActive = true;
      existingUser.transactionPin = undefined; // Remove PIN so we can test setting it
      await existingUser.save();
      
      logger.info('✅ Test user updated successfully (PIN removed for testing)');
    } else {
      // Create test user
      const user = await User.create({
        fullName: 'Test PIN User',
        email: testEmail,
        phone: '+2348012345678',
        password: 'Test1234',
        isEmailVerified: true,
        isActive: true,
      });

      // Create wallet for user
      await Wallet.create({ user: user._id });

      logger.info('✅ Test user created successfully');
    }

    logger.info('📧 Email: testpin@farminvest.com');
    logger.info('🔑 Password: Test1234');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding test user:', error);
    process.exit(1);
  }
};

seedTestUser();
