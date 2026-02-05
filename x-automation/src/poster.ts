import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config.js';
import { TweetContent } from './types.js';

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

export class XPoster {
  private client: TwitterApi | null = null;
  private dryRun: boolean;

  constructor() {
    this.dryRun = config.features.dryRun;

    if (!this.dryRun) {
      this.client = new TwitterApi({
        appKey: config.twitter.appKey,
        appSecret: config.twitter.appSecret,
        accessToken: config.twitter.accessToken,
        accessSecret: config.twitter.accessSecret,
      });
    }
  }

  /**
   * Post a single tweet
   */
  async postTweet(content: TweetContent): Promise<string | null> {
    const tweetText = this.formatTweet(content);

    if (this.dryRun) {
      console.log('[DRY RUN] Would post tweet:');
      console.log(tweetText);
      console.log(`Hashtags: ${content.hashtags.join(', ')}`);
      if (content.mentions) console.log(`Mentions: ${content.mentions.join(', ')}`);
      return 'dry-run-tweet-id';
    }

    try {
      if (!this.client) {
        throw new Error('Twitter client not initialized');
      }

      const tweet = await retryWithBackoff(() => this.client!.v2.tweet(tweetText));
      console.log(`Posted tweet: ${tweet.data.id}`);
      return tweet.data.id;
    } catch (error) {
      console.error('Error posting tweet:', error);
      return null;
    }
  }

  /**
   * Post a thread
   */
  async postThread(content: TweetContent): Promise<string[] | null> {
    if (!content.tweets || content.tweets.length === 0) {
      console.error('No tweets in thread');
      return null;
    }

    if (this.dryRun) {
      console.log('[DRY RUN] Would post thread:');
      content.tweets.forEach((tweet, i) => {
        console.log(`\n--- Tweet ${i + 1}/${content.tweets!.length} ---`);
        console.log(this.formatTweet({ ...content, text: tweet }));
      });
      return content.tweets.map((_, i) => `dry-run-thread-${i}`);
    }

    try {
      if (!this.client) {
        throw new Error('Twitter client not initialized');
      }

      const tweetIds: string[] = [];
      let previousTweetId: string | undefined;

      for (let i = 0; i < content.tweets.length; i++) {
        const tweetText = this.formatTweet({
          ...content,
          text: content.tweets[i],
          // Only add hashtags to the last tweet in thread
          hashtags: i === content.tweets.length - 1 ? content.hashtags : [],
        });

        const tweet = await retryWithBackoff(() =>
          this.client!.v2.tweet({
            text: tweetText,
            reply: previousTweetId ? { in_reply_to_tweet_id: previousTweetId } : undefined,
          })
        );

        tweetIds.push(tweet.data.id);
        previousTweetId = tweet.data.id;

        console.log(`Posted tweet ${i + 1}/${content.tweets.length}: ${tweet.data.id}`);

        // Rate limit protection
        if (i < content.tweets.length - 1) {
          await this.sleep(1000);
        }
      }

      return tweetIds;
    } catch (error) {
      console.error('Error posting thread:', error);
      return null;
    }
  }

  /**
   * Post content (single or thread)
   */
  async post(content: TweetContent): Promise<string[] | null> {
    if (content.type === 'thread') {
      return this.postThread(content);
    } else {
      const tweetId = await this.postTweet(content);
      return tweetId ? [tweetId] : null;
    }
  }

  /**
   * Quote tweet
   */
  async quoteTweet(content: TweetContent, quotedTweetId: string): Promise<string | null> {
    const tweetText = this.formatTweet(content);
    const quotedUrl = `https://twitter.com/i/status/${quotedTweetId}`;

    if (this.dryRun) {
      console.log('[DRY RUN] Would post quote tweet:');
      console.log(tweetText);
      console.log(`Quoting: ${quotedUrl}`);
      return 'dry-run-quote-id';
    }

    try {
      if (!this.client) {
        throw new Error('Twitter client not initialized');
      }

      const tweet = await retryWithBackoff(() =>
        this.client!.v2.tweet({
          text: tweetText,
          quote_tweet_id: quotedTweetId,
        })
      );

      console.log(`Posted quote tweet: ${tweet.data.id}`);
      return tweet.data.id;
    } catch (error) {
      console.error('Error posting quote tweet:', error);
      return null;
    }
  }

  /**
   * Format tweet text with hashtags and mentions
   */
  private formatTweet(content: TweetContent): string {
    let text = content.text;

    // Add hashtags if they fit
    if (content.hashtags.length > 0) {
      const hashtagText = '\n\n' + content.hashtags.join(' ');
      if ((text + hashtagText).length <= config.content.maxTweetLength) {
        text += hashtagText;
      }
    }

    return text;
  }

  /**
   * Validate tweet content
   */
  validateContent(content: TweetContent): boolean {
    if (content.type === 'single') {
      const formatted = this.formatTweet(content);
      if (formatted.length > config.content.maxTweetLength) {
        console.error(`Tweet too long: ${formatted.length} chars`);
        return false;
      }
    } else if (content.type === 'thread') {
      if (!content.tweets || content.tweets.length === 0) {
        console.error('Thread has no tweets');
        return false;
      }

      for (const tweet of content.tweets) {
        if (tweet.length > config.content.maxThreadTweetLength) {
          console.error(`Thread tweet too long: ${tweet.length} chars`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get rate limit status
   * Note: Rate limit info is now handled via retry logic with exponential backoff
   */
  async getRateLimitStatus(): Promise<any> {
    if (this.dryRun || !this.client) {
      return { remaining: 999, limit: 1000 };
    }

    // Rate limits are handled automatically by retryWithBackoff function
    console.log('Rate limit status: monitored automatically via retry logic');
    return { status: 'monitored' };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const xPoster = new XPoster();
