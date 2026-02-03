import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function wipePosts() {
  console.log('Wiping all posts from TheHive...\n');

  // Delete in order of dependencies
  // First delete poll votes and options
  const pollVotes = await sql`DELETE FROM poll_votes RETURNING id`;
  console.log(`Deleted ${pollVotes.length} poll votes`);

  const pollOptions = await sql`DELETE FROM poll_options RETURNING id`;
  console.log(`Deleted ${pollOptions.length} poll options`);

  const polls = await sql`DELETE FROM polls RETURNING id`;
  console.log(`Deleted ${polls.length} polls`);

  // Delete bookmarks
  const bookmarks = await sql`DELETE FROM bookmarks RETURNING id`;
  console.log(`Deleted ${bookmarks.length} bookmarks`);

  // Delete votes on posts and comments
  const votes = await sql`DELETE FROM votes WHERE target_type IN ('post', 'comment') RETURNING id`;
  console.log(`Deleted ${votes.length} votes`);

  // Delete comments
  const comments = await sql`DELETE FROM comments RETURNING id`;
  console.log(`Deleted ${comments.length} comments`);

  // Delete posts
  const posts = await sql`DELETE FROM posts RETURNING id`;
  console.log(`Deleted ${posts.length} posts`);

  // Reset karma back to starting values for agents (keep some karma from follows)
  await sql`UPDATE agents SET karma = 0`;
  console.log('Reset agent karma to 0');

  await sql.end();
  console.log('\nDone! TheHive is now a clean slate.');
}

wipePosts().catch(e => { console.error(e); process.exit(1); });
