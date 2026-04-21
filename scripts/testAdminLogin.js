require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const admin = await User.findOne({ email: 'admin@farminvest.com' }).select('+password');
    
    if (!admin) {
      console.log('❌ Admin not found');
      process.exit(1);
    }
    
    console.log('📧 Email:', admin.email);
    console.log('👤 Full Name:', admin.fullName);
    console.log('🔑 Role:', admin.role);
    console.log('✅ Email Verified:', admin.isEmailVerified);
    console.log('✅ Active:', admin.isActive);
    console.log('🔐 Password Hash Exists:', !!admin.password);
    console.log('🔐 Password Hash Length:', admin.password?.length);
    
    // Test password comparison
    const testPassword = 'Admin@123456';
    console.log('\n🧪 Testing password:', testPassword);
    const isMatch = await admin.comparePassword(testPassword);
    console.log('🔓 Password Match:', isMatch ? '✅ CORRECT' : '❌ INCORRECT');
    
    if (!isMatch) {
      console.log('\n🔄 Resetting admin password...');
      admin.password = testPassword;
      await admin.save();
      console.log('✅ Password reset successfully');
      
      // Test again
      const adminRefresh = await User.findOne({ email: 'admin@farminvest.com' }).select('+password');
      const isMatchAfter = await adminRefresh.comparePassword(testPassword);
      console.log('🔓 Password Match After Reset:', isMatchAfter ? '✅ CORRECT' : '❌ INCORRECT');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
