// Script to seed sample activity logs for testing
require('dotenv').config();
const mongoose = require('mongoose');
const ActivityLog = require('./src/models/ActivityLog');
const User = require('./src/models/User');

async function seedActivityLogs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/farm-invest');
    console.log('Connected to MongoDB');

    // Find or create an admin user
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('No admin user found, creating a test admin...');
      admin = await User.create({
        firstName: 'Test',
        lastName: 'Admin',
        fullName: 'Test Admin',
        email: 'testadmin@farminvest.com',
        phone: '+2341234567890',
        password: 'TestAdmin@123',
        role: 'admin',
        isActive: true,
        kycStatus: 'verified',
      });
      console.log('Created test admin:', admin.fullName);
    } else {
      console.log('Found admin:', admin.fullName);
    }

    // Create sample activity logs
    const sampleLogs = [
      {
        adminUser: admin._id,
        action: 'approve',
        resource: 'withdrawal',
        resourceId: 'WD12345',
        ipAddress: '192.168.1.1',
        details: 'Approved withdrawal request for ₦500,000',
        metadata: {
          amount: 500000,
          transactionReference: 'TXN-2024-001',
        },
        status: 'success',
      },
      {
        adminUser: admin._id,
        action: 'update',
        resource: 'product',
        resourceId: 'PROD789',
        ipAddress: '192.168.1.1',
        details: 'Updated product ROI from 15% to 18%',
        metadata: {
          oldROI: 15,
          newROI: 18,
        },
        status: 'success',
      },
      {
        adminUser: admin._id,
        action: 'suspend',
        resource: 'user',
        resourceId: 'USER456',
        ipAddress: '192.168.1.1',
        details: 'Suspended user account for suspicious activity',
        metadata: {
          reason: 'Multiple failed login attempts',
        },
        status: 'success',
      },
      {
        adminUser: admin._id,
        action: 'create',
        resource: 'product',
        resourceId: 'PROD790',
        ipAddress: '192.168.1.1',
        details: 'Created new product: Premium Cassava Farm',
        metadata: {
          productName: 'Premium Cassava Farm',
          roi: 20,
          duration: 12,
        },
        status: 'success',
      },
      {
        adminUser: admin._id,
        action: 'approve',
        resource: 'user',
        resourceId: 'USER123',
        ipAddress: '192.168.1.1',
        details: 'Approved KYC verification',
        metadata: {
          verificationType: 'KYC',
        },
        status: 'success',
      },
      {
        adminUser: admin._id,
        action: 'login',
        resource: 'admin',
        ipAddress: '192.168.1.1',
        details: 'Admin user logged in to the system',
        status: 'success',
      },
    ];

    // Insert logs
    const logs = await ActivityLog.insertMany(sampleLogs);
    console.log(`✅ Created ${logs.length} sample activity logs`);

    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding activity logs:', error);
    process.exit(1);
  }
}

seedActivityLogs();
