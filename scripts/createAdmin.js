require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log('Connection string:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    
    console.log('✅ MongoDB Connected\n');

    // Get the User model
    const User = mongoose.model('User');
    const Wallet = mongoose.model('Wallet');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@farminvest.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('📧 Email: admin@farminvest.com');
      console.log('🆔 User ID:', existingAdmin._id);
      console.log('👤 Role:', existingAdmin.role);
      console.log('✅ Active:', existingAdmin.isActive);
      
      // Update password if needed
      existingAdmin.password = 'Admin@123456';
      existingAdmin.role = 'admin';
      existingAdmin.isEmailVerified = true;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      
      console.log('\n✅ Admin password updated to: Admin@123456');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash('Admin@123456', 12);
      
      // Create admin user directly
      const admin = new User({
        fullName: 'Farm Invest Admin',
        email: 'admin@farminvest.com',
        phone: '+2348000000000',
        password: hashedPassword,
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
        kycStatus: 'verified'
      });

      await admin.save();
      console.log('✅ Admin user created successfully\n');

      // Create wallet for admin
      const wallet = new Wallet({ 
        user: admin._id,
        balance: 0
      });
      await wallet.save();
      
      console.log('✅ Admin wallet created\n');
      console.log('═══════════════════════════════════');
      console.log('📧 Email: admin@farminvest.com');
      console.log('🔑 Password: Admin@123456');
      console.log('🆔 User ID:', admin._id);
      console.log('═══════════════════════════════════');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    console.error(error);
    process.exit(1);
  }
};

createAdmin();
