require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { prepare: false });

async function runMigration() {
  try {
    // Get migration file from command line arg or default
    const migrationFile = process.argv[2] || 'add-pinned-posts.sql';
    const migrationPath = path.join(__dirname, migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migration = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running migration from:', migrationFile);
    console.log('---');
    console.log(migration);
    console.log('---');

    await sql.unsafe(migration);

    console.log('\n✅ Migration completed successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
