/**
 * Quick test file for development
 * Run with: npm run test
 */

import { highlightFetcher } from './highlights.js';
import { contentTemplates } from './templates.js';
import { config } from '../config.js';

async function runTests() {
  console.log('=== TheHive X Automation Tests ===\n');

  console.log('Configuration:');
  console.log(`- TheHive API: ${config.theHive.baseUrl}`);
  console.log(`- Dry Run: ${config.features.dryRun}`);
  console.log(`- Max posts/day: ${config.posting.maxPostsPerDay}`);
  console.log(`- Schedule: ${config.posting.scheduledTimes.join(', ')}\n`);

  // Test 1: Fetch top posts
  console.log('Test 1: Fetching top posts...');
  try {
    const posts = await highlightFetcher.fetchTopPosts(3);
    console.log(`✓ Found ${posts.length} top posts`);
    if (posts.length > 0) {
      console.log(`  Example: "${posts[0].content.substring(0, 60)}..."`);
      console.log(`  By: ${posts[0].agentName}`);
      console.log(`  Engagement: ${posts[0].upvotes} upvotes, ${posts[0].commentCount} comments`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }
  console.log('');

  // Test 2: Fetch active conversations
  console.log('Test 2: Fetching active conversations...');
  try {
    const debates = await highlightFetcher.fetchActiveConversations(2);
    console.log(`✓ Found ${debates.length} active debates`);
    if (debates.length > 0) {
      console.log(`  Example: ${debates[0].comments.length} comments on "${debates[0].post.content.substring(0, 40)}..."`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }
  console.log('');

  // Test 3: Fetch new agents
  console.log('Test 3: Fetching new agents...');
  try {
    const agents = await highlightFetcher.fetchNewAgents(2);
    console.log(`✓ Found ${agents.length} new agents`);
    if (agents.length > 0) {
      console.log(`  Example: ${agents[0].name}`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }
  console.log('');

  // Test 4: Generate content
  console.log('Test 4: Generating content...');
  try {
    const content = await contentTemplates.generateRandomContent();
    if (content) {
      console.log(`✓ Generated ${content.type} content`);
      console.log(`  Length: ${content.text.length} chars`);
      console.log(`  Hashtags: ${content.hashtags.join(', ')}`);
      console.log(`\n  Preview:\n  ---`);
      if (content.type === 'thread' && content.tweets) {
        content.tweets.forEach((tweet, i) => {
          console.log(`  ${i + 1}. ${tweet.substring(0, 80)}${tweet.length > 80 ? '...' : ''}`);
        });
      } else {
        console.log(`  ${content.text}`);
      }
      console.log(`  ---`);
    } else {
      console.log(`✗ No content generated`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }
  console.log('');

  console.log('=== Tests Complete ===');
}

runTests().catch(console.error);
