import cron from 'node-cron';
import { StatsCollector } from './stats.js';
import { XThreadGenerator } from './thread.js';
import { DigestFormatter } from './formatter.js';

export interface SchedulerConfig {
  // Cron expression for when to run digest
  // Default: Every Sunday at 10am EST
  cronExpression: string;
  timezone: string;
  enabled: boolean;
}

export class DigestScheduler {
  private statsCollector: StatsCollector;
  private threadGenerator: XThreadGenerator;
  private formatter: DigestFormatter;
  private config: SchedulerConfig;
  private task: cron.ScheduledTask | null = null;

  constructor(config?: Partial<SchedulerConfig>) {
    this.statsCollector = new StatsCollector();
    this.threadGenerator = new XThreadGenerator();
    this.formatter = new DigestFormatter();

    this.config = {
      // Every Sunday at 10:00 AM EST
      cronExpression: '0 10 * * 0',
      timezone: 'America/New_York',
      enabled: true,
      ...config,
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('⏸️  Digest scheduler is disabled');
      return;
    }

    if (this.task) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    console.log('🚀 Starting weekly digest scheduler...');
    console.log(`📅 Schedule: ${this.config.cronExpression} (${this.config.timezone})`);
    console.log('   (Every Sunday at 10:00 AM EST)');

    this.task = cron.schedule(
      this.config.cronExpression,
      async () => {
        await this.runDigest();
      },
      {
        scheduled: true,
        timezone: this.config.timezone,
      }
    );

    console.log('✅ Scheduler started successfully\n');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('⏹️  Scheduler stopped');
    }
  }

  /**
   * Run the digest generation and posting
   */
  async runDigest(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log(`🐝 RUNNING WEEKLY DIGEST - ${new Date().toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    try {
      // Step 1: Collect stats
      console.log('📊 Step 1: Collecting weekly stats...');
      const stats = await this.statsCollector.collectWeeklyStats();
      console.log('✅ Stats collected\n');

      // Step 2: Generate formats
      console.log('📝 Step 2: Formatting digest...');
      const formats = this.formatter.formatAll(stats);
      console.log('✅ Digest formatted\n');

      // Step 3: Save preview files
      console.log('💾 Step 3: Saving preview files...');
      await this.formatter.savePreviewFiles(stats, './digest-output');
      console.log('✅ Preview files saved\n');

      // Step 4: Post to X
      console.log('📱 Step 4: Posting thread to X...');
      const result = await this.threadGenerator.postThread(stats);

      if (result.success) {
        console.log('✅ Thread posted successfully!');
        if (result.urls.length > 0) {
          console.log(`🔗 First tweet: ${result.urls[0]}`);
        }
      } else {
        console.error('❌ Failed to post thread:', result.error);
      }

      // Optional: Post summary to TheHive platform
      // await this.postToTheHive(formats.platform);

      console.log('\n' + '='.repeat(80));
      console.log('✅ DIGEST COMPLETE');
      console.log('='.repeat(80) + '\n');
    } catch (error) {
      console.error('\n❌ Error running digest:', error);
      console.log('='.repeat(80) + '\n');
    }
  }

  /**
   * Run digest immediately (for testing)
   */
  async runNow(): Promise<void> {
    console.log('🚀 Running digest immediately...\n');
    await this.runDigest();
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    if (!this.task) {
      return null;
    }

    // Calculate next Sunday at 10am
    const now = new Date();
    const next = new Date(now);

    // Get days until next Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilSunday);
    next.setHours(10, 0, 0, 0);

    // If we've already passed 10am on Sunday, go to next week
    if (next <= now) {
      next.setDate(next.getDate() + 7);
    }

    return next;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    nextRun: Date | null;
    config: SchedulerConfig;
  } {
    return {
      running: this.task !== null,
      nextRun: this.getNextRunTime(),
      config: this.config,
    };
  }

  /**
   * Post digest summary to TheHive platform (optional)
   */
  private async postToTheHive(content: string): Promise<void> {
    // This would require TheHive API client
    // For now, just log that we would post it
    console.log('📝 Would post to TheHive platform:');
    console.log(content.substring(0, 200) + '...\n');

    // TODO: Implement actual posting to TheHive
    // const axios = await import('axios');
    // await axios.post(`${config.theHive.baseUrl}/posts`, {
    //   content,
    //   authorId: 'thehive-bot',
    //   type: 'announcement',
    // });
  }
}

/**
 * Run the scheduler as a standalone process
 */
const isMainModule = process.argv[1]?.includes('scheduler.ts') || process.argv[1]?.includes('scheduler.js');
if (isMainModule) {
  const scheduler = new DigestScheduler();
  scheduler.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n📛 Received SIGINT, shutting down...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n📛 Received SIGTERM, shutting down...');
    scheduler.stop();
    process.exit(0);
  });

  console.log('💡 Press Ctrl+C to stop the scheduler\n');

  // Keep the process alive
  setInterval(() => {
    const status = scheduler.getStatus();
    if (status.nextRun) {
      const timeUntil = status.nextRun.getTime() - Date.now();
      const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
      const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));

      console.log(
        `⏰ Next digest in ${hoursUntil}h ${minutesUntil}m (${status.nextRun.toLocaleString()})`
      );
    }
  }, 60000); // Log every minute
}
