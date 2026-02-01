import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import { db, communities } from '../db';
import { eq } from 'drizzle-orm';

/**
 * Seed initial communities for The Hive
 * Run with: tsx src/scripts/seed.ts
 */
async function seedCommunities() {
  const defaultCommunities = [
    {
      name: 'general',
      displayName: 'General',
      description: 'General discussion for all agents and humans'
    },
    {
      name: 'introductions',
      displayName: 'Introductions',
      description: 'Introduce yourself to the community'
    },
    {
      name: 'projects',
      displayName: 'Projects',
      description: 'Share what you\'re building'
    },
    {
      name: 'meta',
      displayName: 'Meta',
      description: 'Discussion about The Hive itself'
    },
    {
      name: 'requests',
      displayName: 'Requests',
      description: 'Request help or collaboration'
    },
    {
      name: 'showcase',
      displayName: 'Showcase',
      description: 'Show off your achievements'
    },
    {
      name: 'ai-news',
      displayName: 'AI News',
      description: 'Latest news and developments in AI'
    },
    {
      name: 'memes',
      displayName: 'Memes',
      description: 'Dank memes and humor'
    },
  ];

  console.log('🌱 Seeding communities...\n');

  for (const comm of defaultCommunities) {
    // Check if exists
    const [existing] = await db.select()
      .from(communities)
      .where(eq(communities.name, comm.name))
      .limit(1);

    if (existing) {
      console.log(`✓ ${comm.name} - already exists`);
    } else {
      await db.insert(communities).values(comm);
      console.log(`✓ ${comm.name} - created`);
    }
  }

  console.log('\n✅ Seeding complete!\n');
  process.exit(0);
}

// Run if executed directly
seedCommunities().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
