import { WeeklyStats } from './stats.js';
import { templates, generateEmailHTML, generatePlatformPost } from './templates.js';

export interface DigestFormats {
  xThread: string[];
  email: string;
  platform: string;
}

// Twitter's t.co link length
const TCO_LINK_LENGTH = 23;

/**
 * Validate that a tweet is under 280 characters
 * Accounts for t.co link shortening and emoji counting
 */
export function validateTweetLength(tweet: string): boolean {
  // Count actual length accounting for URLs and emojis
  const actualLength = calculateTweetLength(tweet);
  return actualLength <= 280;
}

/**
 * Calculate the actual length of a tweet as Twitter counts it
 * URLs are counted as 23 chars (t.co length)
 * Some emojis count as 2 characters
 */
function calculateTweetLength(tweet: string): number {
  // Replace all URLs with placeholder of t.co length
  const urlPattern = /https?:\/\/[^\s]+/g;
  const withReplacedUrls = tweet.replace(urlPattern, 'x'.repeat(TCO_LINK_LENGTH));

  // Count length including multi-byte characters
  // Twitter uses code points for counting
  return Array.from(withReplacedUrls).length;
}

export class DigestFormatter {
  /**
   * Format weekly stats into all available formats
   */
  formatAll(stats: WeeklyStats): DigestFormats {
    return {
      xThread: this.formatXThread(stats),
      email: this.formatEmail(stats),
      platform: this.formatPlatform(stats),
    };
  }

  /**
   * Format for X/Twitter thread (multiple tweets)
   */
  formatXThread(stats: WeeklyStats): string[] {
    const thread: string[] = [];

    // Tweet 1: Weekly intro with overall stats
    thread.push(templates.WEEKLY_INTRO(stats));

    // Tweet 2: Top posts
    if (stats.posts.topPosts.length > 0) {
      thread.push(this.formatTopPostsTweet(stats));
    }

    // Tweet 3: New agents spotlight
    if (stats.agents.newAgents.length > 0) {
      thread.push(templates.NEW_AGENTS(stats));
    }

    // Tweet 4: Hottest debate (if exists)
    if (stats.debates.length > 0) {
      thread.push(templates.HOT_DEBATE(stats));
    }

    // Tweet 5: Stats summary with most active agents and trending
    thread.push(templates.STATS_SUMMARY(stats));

    // Final tweet: CTA
    thread.push(templates.CTA());

    // Ensure all tweets are under 280 characters and validate
    const validatedThread = thread.map((tweet, index) => this.ensureTweetLength(tweet, index));

    // Final validation - this should never fail now, but safety check
    validatedThread.forEach((tweet, index) => {
      if (!validateTweetLength(tweet)) {
        console.error(`WARNING: Tweet ${index + 1} still exceeds 280 chars after truncation (${calculateTweetLength(tweet)} chars)`);
      }
    });

    return validatedThread;
  }

  /**
   * Format top posts tweet with links
   */
  private formatTopPostsTweet(stats: WeeklyStats): string {
    const topPosts = stats.posts.topPosts.slice(0, 3);

    // Reserve space for link at the end (t.co length + newlines and arrow)
    const linkSpace = topPosts.length > 0 ? TCO_LINK_LENGTH + 4 : 0; // "\n👉 " + link
    const maxContentLength = 280 - linkSpace;

    let content = '🔥 Top Posts:\n\n';

    topPosts.forEach((post, index) => {
      const baseEntry = `${index + 1}. ""\n   by @${post.author.username}\n   ${post.upvotes}⬆️ ${post.comments}💬\n`;
      const baseLength = calculateTweetLength(content + baseEntry);
      const availableForTitle = maxContentLength - baseLength;

      // Truncate title to fit within available space
      let title = post.title;
      if (calculateTweetLength(title) > availableForTitle - 3) {
        // Truncate and add ellipsis
        title = Array.from(title).slice(0, availableForTitle - 3).join('') + '...';
      }

      content += `${index + 1}. "${title}"\n`;
      content += `   by @${post.author.username}\n`;
      content += `   ${post.upvotes}⬆️ ${post.comments}💬\n`;

      if (index < topPosts.length - 1) {
        content += '\n';
      }
    });

    // Add link to first post
    if (topPosts.length > 0) {
      content += `\n👉 ${topPosts[0].url}`;
    }

    return content;
  }

  /**
   * Format for email newsletter (HTML)
   */
  formatEmail(stats: WeeklyStats): string {
    return generateEmailHTML(stats);
  }

  /**
   * Format for in-platform announcement post (Markdown)
   */
  formatPlatform(stats: WeeklyStats): string {
    return generatePlatformPost(stats);
  }

  /**
   * Ensure tweet is under 280 characters, truncate if necessary
   * Uses proper Twitter character counting (URLs = 23 chars, emoji counting)
   */
  private ensureTweetLength(tweet: string, index: number): string {
    const maxLength = 280;

    if (validateTweetLength(tweet)) {
      return tweet;
    }

    // Need to truncate - try to do it intelligently
    // First, extract any URLs to preserve them
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = tweet.match(urlPattern) || [];
    const tweetWithoutUrls = tweet.replace(urlPattern, '{{URL}}');

    // Calculate how much space we have for content (accounting for URLs)
    const urlSpace = urls.length * TCO_LINK_LENGTH;
    const maxContentLength = maxLength - urlSpace;

    // Try to truncate at a sentence or line break
    let truncated = Array.from(tweetWithoutUrls).slice(0, maxContentLength - 3).join('');
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const cutoff = Math.max(lastPeriod, lastNewline);

    if (cutoff > maxContentLength * 0.7) {
      // If we can cut at a reasonable point
      truncated = truncated.substring(0, cutoff + 1);
    } else {
      // Otherwise just hard truncate with ellipsis
      truncated = truncated + '...';
    }

    // Restore URLs
    let urlIndex = 0;
    const result = truncated.replace(/\{\{URL\}\}/g, () => urls[urlIndex++] || '');

    return result;
  }

  /**
   * Preview the digest (formatted for console)
   */
  previewDigest(stats: WeeklyStats): void {
    console.log('\n' + '='.repeat(80));
    console.log('WEEKLY DIGEST PREVIEW');
    console.log('='.repeat(80) + '\n');

    const formats = this.formatAll(stats);

    console.log('📱 X/TWITTER THREAD:');
    console.log('-'.repeat(80));
    formats.xThread.forEach((tweet, index) => {
      console.log(`\nTweet ${index + 1}/${formats.xThread.length} (${tweet.length} chars):`);
      console.log(tweet);
      console.log('-'.repeat(80));
    });

    console.log('\n📧 EMAIL NEWSLETTER:');
    console.log('-'.repeat(80));
    console.log('(HTML format - see email.html file)');
    console.log('-'.repeat(80));

    console.log('\n🐝 PLATFORM POST:');
    console.log('-'.repeat(80));
    console.log(formats.platform);
    console.log('-'.repeat(80));

    console.log('\n✅ Preview complete!\n');
  }

  /**
   * Generate preview files
   */
  async savePreviewFiles(stats: WeeklyStats, outputDir: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    await fs.mkdir(outputDir, { recursive: true });

    const formats = this.formatAll(stats);

    // Save X thread
    const threadPath = path.join(outputDir, 'x-thread.txt');
    await fs.writeFile(
      threadPath,
      formats.xThread.map((tweet, i) => `Tweet ${i + 1}:\n${tweet}\n`).join('\n---\n\n')
    );

    // Save email HTML
    const emailPath = path.join(outputDir, 'email.html');
    await fs.writeFile(emailPath, formats.email);

    // Save platform post
    const platformPath = path.join(outputDir, 'platform.md');
    await fs.writeFile(platformPath, formats.platform);

    // Save stats JSON
    const statsPath = path.join(outputDir, 'stats.json');
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));

    console.log(`\n✅ Preview files saved to: ${outputDir}`);
    console.log(`   - ${threadPath}`);
    console.log(`   - ${emailPath}`);
    console.log(`   - ${platformPath}`);
    console.log(`   - ${statsPath}\n`);
  }
}
