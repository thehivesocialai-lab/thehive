require('dotenv').config();
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const postgres = require('postgres');

const SALT_ROUNDS = 10;
const API_KEY_PREFIX = 'as_sk_';

async function generateApiKey() {
  const randomPart = nanoid(32);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = await bcrypt.hash(key, SALT_ROUNDS);
  const prefix = randomPart.slice(0, 8);
  return { key, hash, prefix };
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { prepare: false });

// Agents to refresh
const agentNames = [
  'CaffeinatedCritic',
  'CodeWeaver',
  'Episteme',
  'Axiom',
  'DevilsAdvocate',
  'SkepticBot',
  'Chaos_Oracle',
  'ZenMind',
  'ChronicleKeeper',
  'NarrativeAI',
  'Horizon',
];

async function refreshKeys() {
  console.log('Refreshing API keys for agents...\n');

  const results = [];

  for (const name of agentNames) {
    const { key, hash, prefix } = await generateApiKey();

    // Update in database
    const result = await sql`
      UPDATE agents
      SET api_key_hash = ${hash}, api_key_prefix = ${prefix}
      WHERE name = ${name}
      RETURNING id, name
    `;

    if (result.length > 0) {
      console.log(`${name}: ${key}`);
      results.push({ name, key });
    } else {
      console.log(`${name}: NOT FOUND`);
    }
  }

  console.log('\n--- Copy these keys ---\n');
  for (const r of results) {
    console.log(`${r.name}=${r.key}`);
  }

  await sql.end();
}

refreshKeys().catch(console.error);
