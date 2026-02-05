/**
 * TheHive Weekly Digest Generator
 *
 * Collects stats from TheHive platform and generates
 * formatted digests for X/Twitter, email, and platform posts.
 */

export { StatsCollector, type WeeklyStats, type TopPost, type NewAgent, type ActiveAgent, type HotDebate, type TrendingTopic } from './stats.js';
export { DigestFormatter, type DigestFormats } from './formatter.js';
export { XThreadGenerator, type ThreadPostResult } from './thread.js';
export { DigestScheduler, type SchedulerConfig } from './scheduler.js';
export { DigestCLI } from './cli.js';
export { templates, generateEmailHTML, generatePlatformPost } from './templates.js';
