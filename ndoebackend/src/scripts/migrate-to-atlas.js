/**
 * Migrate local MongoDB → MongoDB Atlas
 *
 * Usage:
 *   ATLAS_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/glassflow?retryWrites=true&w=majority" \
 *   node src/scripts/migrate-to-atlas.js
 *
 * What it does:
 *   1. Connects to your local DB (MONGO_URI in .env)
 *   2. Connects to Atlas (ATLAS_URI env var or prompt)
 *   3. Copies every collection — clearing the Atlas collection first
 *   4. Prints a summary row per collection
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const LOCAL_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/glassflow';
const ATLAS_URI = process.env.ATLAS_URI;

if (!ATLAS_URI) {
  console.error('\n❌  ATLAS_URI is not set.\n');
  console.error('Run the script like this:\n');
  console.error(
    '  ATLAS_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/glassflow?retryWrites=true&w=majority" \\\n  node src/scripts/migrate-to-atlas.js\n'
  );
  process.exit(1);
}

// Collections to migrate in dependency order
const COLLECTIONS = [
  'counters',
  'settings',
  'users',
  'clients',
  'products',
  'invoices',
  'stagelogs',
  'activitylogs',
];

const pad = (s, n) => String(s).padEnd(n);

const migrate = async () => {
  console.log('\n🔗  Connecting to local MongoDB…');
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();

  console.log('🔗  Connecting to Atlas…');
  const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();

  console.log('\n📦  Starting migration…\n');
  console.log(pad('Collection', 20), pad('Read', 8), pad('Written', 8), 'Status');
  console.log('─'.repeat(52));

  let totalRead = 0;
  let totalWritten = 0;

  for (const name of COLLECTIONS) {
    try {
      const localCol = localConn.db.collection(name);
      const atlasCol = atlasConn.db.collection(name);

      const docs = await localCol.find({}).toArray();
      const count = docs.length;

      if (count === 0) {
        console.log(pad(name, 20), pad(0, 8), pad(0, 8), '⏭  skipped (empty)');
        continue;
      }

      // Clear Atlas collection before inserting
      await atlasCol.deleteMany({});
      await atlasCol.insertMany(docs, { ordered: false });

      totalRead += count;
      totalWritten += count;
      console.log(pad(name, 20), pad(count, 8), pad(count, 8), '✅');
    } catch (err) {
      console.log(pad(name, 20), pad('—', 8), pad('—', 8), `❌  ${err.message}`);
    }
  }

  console.log('─'.repeat(52));
  console.log(pad('TOTAL', 20), pad(totalRead, 8), pad(totalWritten, 8));

  await localConn.close();
  await atlasConn.close();

  console.log('\n✅  Migration complete!');
  console.log('\nNext steps:');
  console.log('  1. Update MONGO_URI in backend/.env to your Atlas connection string');
  console.log('  2. Restart the backend: pnpm dev\n');
};

migrate().catch((err) => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
