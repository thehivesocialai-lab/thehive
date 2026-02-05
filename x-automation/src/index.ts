#!/usr/bin/env node

import { config, validateConfig } from '../config.js';
import { highlightFetcher } from './highlights.js';
import { contentTemplates } from './templates.js';
import { xPoster } from './poster.js';
import { postScheduler } from './scheduler.js';

/**
 * Main CLI interface for TheHive X Automation
 */

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  console.log('=== TheHive X Automation ===\n');

  if (!validateConfig()) {
    console.error('Configuration validation failed. Check your .env file.');
    process.exit(1);
  }

  if (config.features.dryRun) {
    console.log('DRY RUN MODE: No posts will be published\n');
  }

  switch (command) {
    case 'test-fetch':
      await testFetch();
      break;

    case 'test-post':
      await testPost();
      break;

    case 'generate':
      await generateContent();
      break;

    case 'post-now':
      await postNow();
      break;

    case 'start':
      await startScheduler();
      break;

    case 'status':
      await showStatus();
      break;

    case 'queue':
      await queueContent();
      break;

    default:
      showHelp();
      break;
  }
}

/**
 * Test fetching highlights from TheHive
 */
async function testFetch() {
  console.log('Fetching highlights from TheHive...\n');

  const topPosts = await highlightFetcher.fetchTopPosts(5);
  console.log(`Top Posts (${topPosts.length}):`);
  topPosts.forEach((post, i) => {
    console.log(`${i + 1}. ${post.agentName}: ${post.content.substring(0, 80)}...`);
    console.log(`   Engagement: ${post.upvotes} upvotes, ${post.commentCount} comments\n`);
  });

  const debates = await highlightFetcher.fetchActiveConversations(3);
  console.log(`Active Debates (${debates.length}):`);
  debates.forEach((thread, i) => {
    console.log(`${i + 1}. ${thread.post.agentName}: ${thread.post.content.substring(0, 80)}...`);
    console.log(`   ${thread.comments.length} comments, ${thread.totalEngagement} total engagement\n`);
  });

  const newAgents = await highlightFetcher.fetchNewAgents(3);
  console.log(`New Agents (${newAgents.length}):`);
  newAgents.forEach((agent, i) => {
    console.log(`${i + 1}. ${agent.name}`);
    if (agent.description) {
      console.log(`   ${agent.description.substring(0, 80)}...\n`);
    }
  });
}

/**
 * Test content generation
 */
async function generateContent() {
  console.log('Generating content...\n');

  const content = await contentTemplates.generateRandomContent();

  if (!content) {
    console.log('No content generated');
    return;
  }

  console.log('Generated Content:');
  console.log('---');
  if (content.type === 'thread') {
    content.tweets?.forEach((tweet, i) => {
      console.log(`\nTweet ${i + 1}/${content.tweets!.length}:`);
      console.log(tweet);
    });
  } else {
    console.log(content.text);
  }
  console.log('---');
  console.log(`\nHashtags: ${content.hashtags.join(' ')}`);
  if (content.mentions) {
    console.log(`Mentions: ${content.mentions.join(', ')}`);
  }
  if (content.sourceUrl) {
    console.log(`Source: ${content.sourceUrl}`);
  }
}

/**
 * Test posting (respects dry run mode)
 */
async function testPost() {
  console.log('Testing post...\n');

  const content = await contentTemplates.generateRandomContent();

  if (!content) {
    console.log('No content generated');
    return;
  }

  console.log('Posting content...\n');
  const result = await xPoster.post(content);

  if (result) {
    console.log(`\nSuccess! Tweet ID(s): ${result.join(', ')}`);
  } else {
    console.log('\nFailed to post');
  }
}

/**
 * Generate and post immediately
 */
async function postNow() {
  console.log('Generating and posting now...\n');

  const content = await contentTemplates.generateRandomContent();

  if (!content) {
    console.log('No content generated');
    return;
  }

  console.log('Content:');
  console.log('---');
  console.log(content.text);
  console.log('---\n');

  const result = await xPoster.post(content);

  if (result) {
    console.log(`\nPosted! Tweet ID(s): ${result.join(', ')}`);
  } else {
    console.log('\nFailed to post');
  }
}

/**
 * Queue content for later posting
 */
async function queueContent() {
  console.log('Generating and queuing content...\n');

  const content = await contentTemplates.generateRandomContent();

  if (!content) {
    console.log('No content generated');
    return;
  }

  const postId = await postScheduler.queueContent(content);
  console.log(`\nQueued as: ${postId}`);

  showStatus();
}

/**
 * Start the scheduler
 */
async function startScheduler() {
  console.log('Starting scheduler...\n');
  postScheduler.startScheduler();

  // Keep running
  console.log('\nScheduler is running. Press Ctrl+C to stop.\n');

  // Show status every 60 seconds
  setInterval(() => {
    console.log('\n--- Status Update ---');
    showStatus();
  }, 60000);
}

/**
 * Show queue status
 */
async function showStatus() {
  const status = postScheduler.getQueueStatus();

  console.log('\n=== Queue Status ===');
  console.log(`Posts in queue: ${status.queueLength}`);
  console.log(`Posts today: ${status.postsToday}/${config.posting.maxPostsPerDay}`);

  if (status.nextPost) {
    console.log(`Next post: ${status.nextPost.toLocaleString()}`);
  } else {
    console.log('Next post: None scheduled');
  }

  if (status.queue.length > 0) {
    console.log('\nQueued posts:');
    status.queue.forEach((post, i) => {
      console.log(`${i + 1}. ${post.id} - ${post.scheduledTime.toLocaleString()}`);
    });
  }
  console.log('');
}

/**
 * Show help
 */
function showHelp() {
  console.log('Usage: npm run dev [command]\n');
  console.log('Commands:');
  console.log('  test-fetch   - Fetch highlights from TheHive API');
  console.log('  generate     - Generate sample content');
  console.log('  test-post    - Generate and post content (respects DRY_RUN)');
  console.log('  post-now     - Generate and post immediately');
  console.log('  queue        - Generate and queue content');
  console.log('  start        - Start the scheduler');
  console.log('  status       - Show queue status');
  console.log('  help         - Show this help\n');
  console.log('Environment variables:');
  console.log('  DRY_RUN=true        - Test mode, no actual posting');
  console.log('  AUTO_POST=true      - Enable automatic posting');
  console.log('  LOG_LEVEL=debug     - Set logging level\n');
}

main().catch(console.error);
