import cron from 'node-cron';
import { config } from '../config.js';
import { contentTemplates } from './templates.js';
import { xPoster } from './poster.js';
import { ScheduledPost, TweetContent } from './types.js';

export class PostScheduler {
  private queue: ScheduledPost[] = [];
  private lastPostTime: Date | null = null;
  private postsToday: number = 0;
  private lastResetDate: string;

  constructor() {
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Add content to the queue
   */
  async queueContent(content: TweetContent, scheduledTime?: Date): Promise<string> {
    const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const post: ScheduledPost = {
      id: postId,
      content,
      scheduledTime: scheduledTime || this.getNextAvailableTime(),
      posted: false,
    };

    this.queue.push(post);
    this.queue.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    console.log(`Queued post ${postId} for ${post.scheduledTime.toISOString()}`);
    return postId;
  }

  /**
   * Get next available posting time
   */
  private getNextAvailableTime(): Date {
    const now = new Date();
    const minInterval = config.posting.minHoursBetweenPosts * 60 * 60 * 1000;

    // If we've posted recently, wait for the minimum interval
    if (this.lastPostTime) {
      const timeSinceLastPost = now.getTime() - this.lastPostTime.getTime();
      if (timeSinceLastPost < minInterval) {
        return new Date(this.lastPostTime.getTime() + minInterval);
      }
    }

    // Check daily limit
    this.resetDailyCountIfNeeded();
    if (this.postsToday >= config.posting.maxPostsPerDay) {
      // Schedule for tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }

    return now;
  }

  /**
   * Reset daily post count if it's a new day
   */
  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.postsToday = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Process the queue and post when ready
   */
  async processQueue(): Promise<void> {
    const now = new Date();
    this.resetDailyCountIfNeeded();

    // Check daily limit
    if (this.postsToday >= config.posting.maxPostsPerDay) {
      console.log('Daily post limit reached');
      return;
    }

    // Find posts ready to be published
    const readyPosts = this.queue.filter(
      post => !post.posted && post.scheduledTime <= now
    );

    for (const post of readyPosts) {
      try {
        console.log(`\nProcessing post ${post.id}...`);

        // Validate content
        if (!xPoster.validateContent(post.content)) {
          console.error(`Invalid content for post ${post.id}`);
          post.posted = true; // Mark as posted to skip it
          continue;
        }

        // Post to X
        const tweetIds = await xPoster.post(post.content);

        if (tweetIds) {
          post.posted = true;
          post.postedAt = new Date();
          post.tweetId = tweetIds[0];
          this.lastPostTime = new Date();
          this.postsToday++;

          console.log(`Successfully posted ${post.id}`);
          console.log(`Tweet ID(s): ${tweetIds.join(', ')}`);
        } else {
          console.error(`Failed to post ${post.id}`);
        }

        // Rate limit protection
        await this.sleep(2000);

      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
      }
    }

    // Clean up posted items
    this.queue = this.queue.filter(post => !post.posted);
  }

  /**
   * Auto-generate and queue content
   */
  async autoQueueContent(): Promise<void> {
    console.log('\nAuto-generating content...');

    try {
      const content = await contentTemplates.generateRandomContent();

      if (content) {
        await this.queueContent(content);
        console.log('Content queued successfully');
      } else {
        console.log('No content generated');
      }
    } catch (error) {
      console.error('Error auto-queuing content:', error);
    }
  }

  /**
   * Start the scheduler with cron jobs
   */
  startScheduler(): void {
    console.log('Starting scheduler...');
    console.log(`Timezone: ${config.posting.timezone}`);
    console.log(`Scheduled times: ${config.posting.scheduledTimes.join(', ')}`);

    // Process queue every minute
    cron.schedule('* * * * *', async () => {
      await this.processQueue();
    });

    // Auto-generate content at scheduled times
    config.posting.scheduledTimes.forEach(time => {
      const [hours, minutes] = time.split(':');
      const cronTime = `${minutes} ${hours} * * *`;

      cron.schedule(cronTime, async () => {
        console.log(`\n=== Scheduled content generation at ${time} ===`);
        await this.autoQueueContent();
      }, {
        timezone: config.posting.timezone,
      });

      console.log(`Scheduled auto-generation at ${time} ${config.posting.timezone}`);
    });

    console.log('Scheduler started successfully');
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    postsToday: number;
    nextPost: Date | null;
    queue: ScheduledPost[];
  } {
    return {
      queueLength: this.queue.length,
      postsToday: this.postsToday,
      nextPost: this.queue.length > 0 ? this.queue[0].scheduledTime : null,
      queue: this.queue,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
    console.log('Queue cleared');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const postScheduler = new PostScheduler();

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== TheHive X Automation Scheduler ===\n');

  if (!config.features.dryRun) {
    console.log('WARNING: Running in LIVE mode. Posts will be published to X.');
    console.log('Set DRY_RUN=true in .env to test without posting.\n');
  } else {
    console.log('Running in DRY RUN mode. No posts will be published.\n');
  }

  postScheduler.startScheduler();

  // Keep process running
  process.on('SIGINT', () => {
    console.log('\nShutting down scheduler...');
    process.exit(0);
  });
}
