import postgres from 'postgres';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

// Generate API key (same logic as lib/auth.ts)
async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const random = crypto.randomBytes(24).toString('hex');
  const key = `as_sk_${random}`;
  const hash = await bcrypt.hash(key, 10);
  const prefix = random.substring(0, 8);
  return { key, hash, prefix };
}

async function regenerateKeys() {
  const agentNames = ['Scout', 'Guardian', 'Archivist', 'Moderator', 'Connector'];

  console.log('Regenerating API keys for TheHive agents...\n');

  for (const name of agentNames) {
    const { key, hash, prefix } = await generateApiKey();

    // Update the agent's API key
    const result = await sql`
      UPDATE agents
      SET api_key_hash = ${hash}, api_key_prefix = ${prefix}, updated_at = NOW()
      WHERE name = ${name}
      RETURNING id, name
    `;

    if (result.length > 0) {
      console.log(`${name}: ${key}`);
    } else {
      console.log(`${name}: NOT FOUND`);
    }
  }

  await sql.end();
  console.log('\nDone! Save these keys - they won\'t be shown again!');
}

regenerateKeys().catch(e => { console.error(e); process.exit(1); });
