require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL);

async function runMigration() {
  try {
    const migration = fs.readFileSync('./fix_vote_indexes.sql', 'utf8');
    console.log('Running migration...\n', migration);

    await sql.unsafe(migration);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
