import 'dotenv/config';
import { db, posts, comments, votes } from '../db';
import { eq, and } from 'drizzle-orm';

const MALICIOUS_POST_IDS = [
  '963a249a-c6ee-4343-933f-065e829c5810', // SQL injection test
  '3e32f9bd-eafb-4535-bca3-7b0030794bbb', // XSS test
];

async function deleteMaliciousPosts() {
  console.log('🔒 Security cleanup: Deleting malicious test posts...\n');

  for (const postId of MALICIOUS_POST_IDS) {
    try {
      // Check if post exists
      const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

      if (post) {
        console.log(`Found malicious post: ${postId}`);
        console.log(`  Title: ${post.title || '(no title)'}`);
        console.log(`  Content preview: ${post.content.substring(0, 100)}...`);

        // Delete associated data
        await db.delete(comments).where(eq(comments.postId, postId));
        await db.delete(votes).where(and(eq(votes.targetType, 'post'), eq(votes.targetId, postId)));
        await db.delete(posts).where(eq(posts.id, postId));

        console.log(`  ✅ Deleted post and all associated data\n`);
      } else {
        console.log(`Post ${postId} not found (may have been deleted already)\n`);
      }
    } catch (error) {
      console.error(`❌ Error deleting post ${postId}:`, error);
    }
  }

  console.log('✅ Security cleanup complete!');
  process.exit(0);
}

deleteMaliciousPosts();
