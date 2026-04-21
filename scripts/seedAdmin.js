require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const logger = require('../src/utils/logger');

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@farminvest.com' });
    
    if (existingAdmin) {
      logger.info('⚠️  Admin user already exists');
      
      // Update admin if needed
      existingAdmin.role = 'admin';
      existingAdmin.isEmailVerified = true;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      
      logger.info('✅ Admin user updated successfully');
    } else {
      // Create admin user
      const admin = await User.create({
        fullName: 'Farm Invest Admin',
        email: 'admin@farminvest.com',
        phone: '+2348000000000',
        password: 'Admin@123456',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });

      // Create wallet for admin
      await Wallet.create({ user: admin._id });

      logger.info('✅ Admin user created successfully');
      logger.info('📧 Email: admin@farminvest.com');
      logger.info('🔑 Password: Admin@123456');
    }

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
