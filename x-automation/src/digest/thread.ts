import { TwitterApi } from 'twitter-api-v2';
import { config } from '../../config.js';
import { WeeklyStats } from './stats.js';
import { DigestFormatter } from './formatter.js';

/**
 * Retry with exponential backoff for rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (HTTP 429)
      const isRateLimit =
        error.code === 429 ||
        error.statusCode === 429 ||
        error.response?.status === 429 ||
        error.message?.includes('rate limit');

      if (!isRateLimit) {
        // Not a rate limit error, don't retry
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export interface ThreadPostResult {
  success: boolean;
  tweetIds: string[];
  urls: string[];
  error?: string;
  partialSuccess?: boolean;
  failedAtIndex?: number;
  successfulTweetCount?: number;
}

export class XThreadGenerator {
  private client: TwitterApi | null = null;
  private formatter: DigestFormatter;

  constructor() {
    this.formatter = new DigestFormatter();
    this.initializeClient();
  }

  /**
   * Initialize Twitter API client
   */
  private initializeClient(): void {
    if (config.features.dryRun) {
      console.log('🔵 Dry run mode - Twitter client not initialized');
      return;
    }

    try {
      this.client = new TwitterApi({
        appKey: config.twitter.appKey,
        appSecret: config.twitter.appSecret,
        accessToken: config.twitter.accessToken,
        accessSecret: config.twitter.accessSecret,
      });

      console.log('✅ Twitter API client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error);
    }
  }

  /**
   * Generate and post X thread from weekly stats
   */
  async postThread(stats: WeeklyStats): Promise<ThreadPostResult> {
    const tweets = this.formatter.formatXThread(stats);

    console.log(`\n📱 Posting thread with ${tweets.length} tweets...\n`);

    // Dry run mode - just preview
    if (config.features.dryRun || !this.client) {
      console.log('🔵 DRY RUN - Would post the following thread:\n');
      tweets.forEach((tweet, index) => {
        console.log(`Tweet ${index + 1}/${tweets.length}:`);
        console.log(tweet);
        console.log('\n---\n');
      });

      return {
        success: true,
        tweetIds: tweets.map((_, i) => `dry-run-${i}`),
        urls: tweets.map((_, i) => `https://twitter.com/dry-run/status/${i}`),
      };
    }

    // Actually post the thread
    const tweetIds: string[] = [];
    const urls: string[] = [];
    let previousTweetId: string | undefined;
    let username: string = '';

    try {
      // Get username once at the start (cache it)
      const me = await this.client.v2.me();
      username = me.data.username;

      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];

        console.log(`Posting tweet ${i + 1}/${tweets.length}...`);

        try {
          const response = await retryWithBackoff(() =>
            this.client!.v2.tweet({
              text: tweet,
              reply: previousTweetId
                ? {
                    in_reply_to_tweet_id: previousTweetId,
                  }
                : undefined,
            })
          );

          const tweetId = response.data.id;
          tweetIds.push(tweetId);

          // Use cached username for URL
          const url = `https://twitter.com/${username}/status/${tweetId}`;
          urls.push(url);

          console.log(`✅ Posted: ${url}`);

          previousTweetId = tweetId;

          // Wait 2 seconds between tweets to avoid rate limiting
          if (i < tweets.length - 1) {
            await this.sleep(2000);
          }
        } catch (tweetError: any) {
          // Partial failure - some tweets were posted
          console.error(`\n❌ Error posting tweet ${i + 1}:`, tweetError.message);
          console.error(`\n⚠️ PARTIAL THREAD POSTED - ${tweetIds.length}/${tweets.length} tweets were successful`);

          if (tweetIds.length > 0) {
            console.error(`\n🔗 Posted tweets (you may want to delete these manually):`);
            urls.forEach((url, idx) => {
              console.error(`   ${idx + 1}. ${url} (ID: ${tweetIds[idx]})`);
            });

            // Save state to file for recovery
            await this.savePartialThreadState({
              timestamp: new Date().toISOString(),
              totalTweets: tweets.length,
              successfulTweets: tweetIds.length,
              failedAtIndex: i,
              tweetIds,
              urls,
              remainingTweets: tweets.slice(i),
            });
          }

          return {
            success: false,
            partialSuccess: tweetIds.length > 0,
            failedAtIndex: i,
            successfulTweetCount: tweetIds.length,
            tweetIds,
            urls,
            error: `Failed at tweet ${i + 1}: ${tweetError.message}`,
          };
        }
      }

      console.log(`\n✅ Thread posted successfully!`);
      console.log(`🔗 First tweet: ${urls[0]}\n`);

      return {
        success: true,
        tweetIds,
        urls,
      };
    } catch (error: any) {
      // Error before posting any tweets
      console.error('❌ Error posting thread:', error);

      return {
        success: false,
        tweetIds,
        urls,
        error: error.message || 'Unknown error',
        partialSuccess: tweetIds.length > 0,
        successfulTweetCount: tweetIds.length,
      };
    }
  }

  /**
   * Generate thread without posting (for preview)
   */
  async generateThread(stats: WeeklyStats): Promise<string[]> {
    return this.formatter.formatXThread(stats);
  }

  /**
   * Post a single tweet (non-threaded)
   */
  async postSingleTweet(text: string): Promise<ThreadPostResult> {
    if (config.features.dryRun || !this.client) {
      console.log('🔵 DRY RUN - Would post tweet:');
      console.log(text);
      return {
        success: true,
        tweetIds: ['dry-run-single'],
        urls: ['https://twitter.com/dry-run/status/single'],
      };
    }

    try {
      const response = await retryWithBackoff(() => this.client!.v2.tweet({ text }));
      const me = await this.client.v2.me();
      const url = `https://twitter.com/${me.data.username}/status/${response.data.id}`;

      console.log(`✅ Tweet posted: ${url}`);

      return {
        success: true,
        tweetIds: [response.data.id],
        urls: [url],
      };
    } catch (error: any) {
      console.error('❌ Error posting tweet:', error);
      return {
        success: false,
        tweetIds: [],
        urls: [],
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Validate thread before posting
   */
  validateThread(tweets: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (tweets.length === 0) {
      errors.push('Thread is empty');
    }

    if (tweets.length > 25) {
      errors.push(`Thread too long: ${tweets.length} tweets (max 25)`);
    }

    tweets.forEach((tweet, index) => {
      if (tweet.length > 280) {
        errors.push(`Tweet ${index + 1} exceeds 280 characters (${tweet.length})`);
      }

      if (tweet.trim().length === 0) {
        errors.push(`Tweet ${index + 1} is empty`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Preview thread in console
   */
  previewThread(stats: WeeklyStats): void {
    this.formatter.previewDigest(stats);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Save partial thread state to file for recovery
   */
  private async savePartialThreadState(state: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const stateDir = path.join(process.cwd(), 'logs', 'failed-threads');
      await fs.mkdir(stateDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const stateFile = path.join(stateDir, `partial-thread-${timestamp}.json`);

      await fs.writeFile(stateFile, JSON.stringify(state, null, 2));

      console.error(`\n💾 Partial thread state saved to: ${stateFile}`);
    } catch (error) {
      console.error('Failed to save partial thread state:', error);
    }
  }
}
