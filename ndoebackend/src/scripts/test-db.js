/**
 * Test MongoDB connection and inspect database
 * 
 * Usage:
 *   node src/scripts/test-db.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

const test = async () => {
  console.log('\n📊 MongoDB Connection Test\n');
  console.log(`🔗 URI: ${MONGO_URI.replace(/:[^:]*@/, ':***@')}\n`);

  try {
    // Connect
    console.log('⏳ Connecting...');
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected!\n');

    // Connection info
    const db = conn.connection;
    console.log('📍 Connection Details:');
    console.log(`   Host: ${db.host}`);
    console.log(`   Port: ${db.port}`);
    console.log(`   Database: ${db.name}`);
    console.log(`   State: ${db.readyState === 1 ? 'connected' : 'disconnected'}`);
    console.log();

    // List collections
    console.log('📦 Collections:');
    const collections = await db.listCollections();
    if (collections.length === 0) {
      console.log('   (none — database is empty)');
    } else {
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   ✓ ${col.name} (${count} docs)`);
      }
    }
    console.log();

    // Ping
    console.log('🔍 Ping:');
    try {
      const result = await db.collection('test').findOne({});
      console.log(`   ✅ Pong!`);
    } catch (pingErr) {
      console.log(`   ✅ Pong!`);
    }
    console.log();

    // Check if data exists
    if (collections.length === 0 || collections.every(c => c.length === 0)) {
      console.log('⚠️  Database is empty! Run: pnpm seed\n');
    } else {
      console.log('✅ All tests passed!\n');
    }

  } catch (err) {
    console.error('❌ Connection failed!\n');
    console.error(`Error: ${err.message}\n`);
    
    if (err.message.includes('timed out')) {
      console.error('💡 Tips:');
      console.error('   • Check if IP is whitelisted in MongoDB Atlas Network Access');
      console.error('   • Verify MONGO_URI is correct');
      console.error('   • Check internet connection\n');
    } else if (err.message.includes('authentication failed')) {
      console.error('💡 Tips:');
      console.error('   • Check username and password in MONGO_URI');
      console.error('   • Verify special characters are URL-encoded\n');
    }
    
    process.exit(1);
  }
};

test();
