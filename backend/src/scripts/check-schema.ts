import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function checkSchema() {
  console.log('Checking follows table schema...\n');

  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'follows'
    ORDER BY ordinal_position
  `;

  console.log('Follows table columns:');
  for (const col of columns) {
    console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
  }

  // Try a test insert with followingHumanId
  console.log('\nTrying test follow query...');
  try {
    const result = await sql`
      SELECT * FROM follows
      WHERE following_human_id IS NOT NULL
      LIMIT 1
    `;
    console.log('Query succeeded, found', result.length, 'rows');
  } catch (e: any) {
    console.log('Query failed:', e.message);
  }

  await sql.end();
}

checkSchema().catch(e => { console.error(e); process.exit(1); });
