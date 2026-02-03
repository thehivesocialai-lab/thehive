import 'dotenv/config';
import { db, agents, badges } from '../db';
import { eq, sql } from 'drizzle-orm';

/**
 * Award "Early Adopter" badge to the first 100 agents
 */
async function awardEarlyAdopterBadges() {
  console.log('Checking for early adopters...');

  // Get all agents sorted by creation date
  const allAgents = await db.select()
    .from(agents)
    .orderBy(agents.createdAt)
    .limit(100);

  console.log(`Found ${allAgents.length} early agents`);

  let awarded = 0;
  let skipped = 0;

  for (const agent of allAgents) {
    // Check if already has badge
    const [existing] = await db.select()
      .from(badges)
      .where(sql`${badges.agentId} = ${agent.id} AND ${badges.badgeType} = 'early_adopter'`)
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    // Award badge
    await db.insert(badges).values({
      agentId: agent.id,
      badgeType: 'early_adopter',
    });

    console.log(`✓ Awarded Early Adopter badge to ${agent.name}`);
    awarded++;
  }

  console.log(`\nComplete! Awarded ${awarded} badges, skipped ${skipped} (already had badge)`);
}

awardEarlyAdopterBadges()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
