/**
 * Script to fix the phoneNumber index issue
 * This script drops the old phoneNumber_1 index and allows the application to recreate it with the correct partial filter
 * 
 * Usage: node scripts/fix-phone-index.js
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string - update if needed
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unicx-test';

async function fixPhoneIndex() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const usersCollection = db.collection('users');

    // Check existing indexes
    console.log('\n📋 Current indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the old phoneNumber_1 index if it exists
    try {
      console.log('\n🗑️  Dropping old phoneNumber_1 index...');
      await usersCollection.dropIndex('phoneNumber_1');
      console.log('✅ Old index dropped successfully!');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index phoneNumber_1 does not exist (already dropped or never created)');
      } else {
        throw error;
      }
    }

    // Create the new partial unique index
    console.log('\n🔧 Creating new partial unique index...');
    await usersCollection.createIndex(
      { phoneNumber: 1 },
      {
        unique: true,
        name: 'phoneNumber_1',
        partialFilterExpression: { phoneNumber: { $type: 'string' } }
      }
    );
    console.log('✅ New partial unique index created successfully!');

    // Verify the new index
    console.log('\n📋 Updated indexes:');
    const updatedIndexes = await usersCollection.indexes();
    updatedIndexes.forEach(index => {
      if (index.name === 'phoneNumber_1') {
        console.log(`  - ${index.name}:`, JSON.stringify(index, null, 2));
      }
    });

    console.log('\n✨ Index fix completed successfully!');
    console.log('You can now create multiple users without phone numbers (TenantAdmin/SystemAdmin)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixPhoneIndex();

