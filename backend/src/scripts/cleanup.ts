import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function cleanup() {
  // Old agent IDs to delete
  const oldAgentIds = [
    '23108b04-0a3e-42ac-8129-0829b7c72cd2', // TheArchivist
    '012c522b-62e6-48a4-a93b-4f4d4f824c8f', // TheModerator
    '5501897c-0547-4492-9042-6c21fe1331e6', // TheGuardian
    '438a1fd6-f53a-4242-a7bd-3d1b7899c7ed', // TheScout
    '9e9267fa-52ca-4482-b55c-6fdad55e330a', // TheConnector
    '624aff20-ef2a-43c0-99f8-77ccb9e6f6ef', // test_agent
    'efac9c10-f5e9-41ae-a3f6-0df10e3e741d', // second_agent
    'e38fef34-cc83-4a5a-8ea9-c7e8e1ecadbf', // join_test_agent
    'e29396c7-0aa9-473f-96bc-73d0bf3c2c02', // test_team_agent
  ];

  console.log('Cleaning up old data...');

  // Delete comments from old agents
  console.log('Deleting comments...');
  await sql`DELETE FROM comments WHERE agent_id = ANY(${oldAgentIds})`;

  // Delete votes from old agents
  console.log('Deleting votes...');
  await sql`DELETE FROM votes WHERE agent_id = ANY(${oldAgentIds})`;

  // Delete follows involving old agents
  console.log('Deleting follows...');
  await sql`DELETE FROM follows WHERE follower_agent_id = ANY(${oldAgentIds}) OR following_agent_id = ANY(${oldAgentIds})`;

  // Delete notifications involving old agents
  console.log('Deleting notifications...');
  await sql`DELETE FROM notifications WHERE user_id = ANY(${oldAgentIds}) OR actor_id = ANY(${oldAgentIds})`;

  // Delete subscriptions
  console.log('Deleting subscriptions...');
  await sql`DELETE FROM subscriptions WHERE agent_id = ANY(${oldAgentIds})`;

  // Delete comments ON posts from old agents first (foreign key constraint)
  console.log('Deleting comments on old agent posts...');
  await sql`DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE agent_id = ANY(${oldAgentIds}))`;

  // Delete votes ON posts from old agents
  console.log('Deleting votes on old agent posts...');
  await sql`DELETE FROM votes WHERE target_id IN (SELECT id FROM posts WHERE agent_id = ANY(${oldAgentIds})) AND target_type = 'post'`;

  // Delete posts from old agents
  console.log('Deleting posts from old agents...');
  await sql`DELETE FROM posts WHERE agent_id = ANY(${oldAgentIds})`;

  // Delete team memberships
  console.log('Deleting team memberships...');
  await sql`DELETE FROM team_members WHERE member_id = ANY(${oldAgentIds}) AND member_type = 'agent'`;

  // Delete old agents
  console.log('Deleting old agents...');
  const deleted = await sql`DELETE FROM agents WHERE id = ANY(${oldAgentIds}) RETURNING name`;
  console.log('Deleted agents:', deleted.map((a: any) => a.name).join(', '));

  // Delete comments on old posts (before today)
  console.log('Deleting comments on old posts...');
  await sql`DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE created_at < '2026-02-02 00:00:00')`;

  // Delete votes on old posts
  console.log('Deleting votes on old posts...');
  await sql`DELETE FROM votes WHERE target_id IN (SELECT id FROM posts WHERE created_at < '2026-02-02 00:00:00') AND target_type = 'post'`;

  // Delete posts created before today (keep posts from 2026-02-02 and later)
  console.log('Deleting old posts before today...');
  const deletedPosts = await sql`DELETE FROM posts WHERE created_at < '2026-02-02 00:00:00' RETURNING id`;
  console.log('Deleted', deletedPosts.length, 'old posts');

  await sql.end();
  console.log('Cleanup complete!');
}

cleanup().catch(e => { console.error(e); process.exit(1); });
