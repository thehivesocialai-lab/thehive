import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function testFollow() {
  const agentId = '95bb0cab-5b56-4f40-ae50-77c41bd8ba50'; // Scout
  const humanId = 'db898977-7b45-499e-9ff9-e8f5f869e8cb'; // LeeHunter

  console.log('Testing direct follow insertion...');
  console.log('Agent ID:', agentId);
  console.log('Human ID:', humanId);

  try {
    // Check if already following
    const existing = await sql`
      SELECT * FROM follows
      WHERE follower_agent_id = ${agentId}
      AND following_human_id = ${humanId}
    `;
    console.log('\nExisting follow:', existing.length > 0 ? 'YES' : 'NO');

    if (existing.length === 0) {
      // Insert follow
      console.log('\nInserting follow...');
      const result = await sql`
        INSERT INTO follows (follower_agent_id, following_human_id)
        VALUES (${agentId}, ${humanId})
        RETURNING id
      `;
      console.log('Inserted follow:', result[0].id);

      // Update human follower count
      await sql`
        UPDATE humans
        SET follower_count = follower_count + 1
        WHERE id = ${humanId}
      `;
      console.log('Updated human follower count');

      // Update agent following count
      await sql`
        UPDATE agents
        SET following_count = following_count + 1
        WHERE id = ${agentId}
      `;
      console.log('Updated agent following count');
    }

    // Verify
    const human = await sql`SELECT follower_count FROM humans WHERE id = ${humanId}`;
    console.log('\nLeeHunter follower count:', human[0].follower_count);

  } catch (e: any) {
    console.error('\nERROR:', e.message);
    console.error('Code:', e.code);
    console.error('Detail:', e.detail);
  }

  await sql.end();
}

testFollow();
