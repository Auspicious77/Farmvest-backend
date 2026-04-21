require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

// Import all models to ensure collections are created
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Investment = require('../src/models/Investment');
const Transaction = require('../src/models/Transaction');
const Wallet = require('../src/models/Wallet');
const ActivityLog = require('../src/models/ActivityLog');
const Notification = require('../src/models/Notification');
const Revenue = require('../src/models/Revenue');
const Recommendation = require('../src/models/Recommendation');

const regenerateCollections = async () => {
  try {
    console.log('🔄 Starting collection regeneration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Get list of all models
    const models = [
      { name: 'User', model: User },
      { name: 'Product', model: Product },
      { name: 'Investment', model: Investment },
      { name: 'Transaction', model: Transaction },
      { name: 'Wallet', model: Wallet },
      { name: 'ActivityLog', model: ActivityLog },
      { name: 'Notification', model: Notification },
      { name: 'Revenue', model: Revenue },
      { name: 'Recommendation', model: Recommendation },
    ];

    console.log('📋 Collections to be created:\n');
    models.forEach(({ name }) => {
      console.log(`   - ${name.toLowerCase()}s`);
    });
    console.log('');

    // Create collections with indexes
    for (const { name, model } of models) {
      try {
        // Create the collection
        await model.createCollection();
        console.log(`✅ Created collection: ${name.toLowerCase()}s`);

        // Ensure indexes are created
        await model.createIndexes();
        console.log(`✅ Created indexes for: ${name.toLowerCase()}s`);
      } catch (error) {
        if (error.code === 48) {
          // Collection already exists
          console.log(`ℹ️  Collection already exists: ${name.toLowerCase()}s`);
          // Still ensure indexes
          await model.createIndexes();
          console.log(`✅ Updated indexes for: ${name.toLowerCase()}s`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✨ All collections regenerated successfully!');
    console.log('\n📊 Database Statistics:');
    
    // Show collection stats
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`   Total collections: ${collections.length}`);
    console.log('\n   Collections:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('\n🎉 Collection regeneration completed!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error regenerating collections:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
regenerateCollections();
