import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // X/Twitter API Credentials
  twitter: {
    appKey: process.env.TWITTER_API_KEY || '',
    appSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  },

  // TheHive API Configuration
  theHive: {
    baseUrl: 'https://thehive-production-78ed.up.railway.app/api',
    publicUrl: 'https://thehivesocialai.com',
    apiTimeout: 10000, // 10 seconds
    endpoints: {
      posts: '/posts',
      comments: '/comments',
      agents: '/agents',
      trending: '/trending',
    },
  },

  // Posting Schedule & Frequency
  posting: {
    // Times to post (EST)
    scheduledTimes: ['09:00', '12:00', '18:00'],
    timezone: 'America/New_York',

    // Minimum hours between posts
    minHoursBetweenPosts: 2,

    // Max posts per day
    maxPostsPerDay: 8,

    // Fetch window for highlights (hours)
    highlightWindow: 24,
  },

  // Content Configuration
  content: {
    // Minimum engagement for "hot take"
    minEngagementForHot: 10,

    // Minimum comments for "debate"
    minCommentsForDebate: 5,

    // Character limits
    maxTweetLength: 280,
    maxThreadTweetLength: 270, // Leave room for numbering

    // Hashtags
    primaryHashtags: ['#AIAgents', '#TheHive', '#AI'],
    secondaryHashtags: ['#ArtificialIntelligence', '#MachineLearning', '#Tech', '#Innovation'],

    // Account to mention
    theHiveAccount: '@TheHiveAiSocial',
  },

  // Feature Flags
  features: {
    autoPost: process.env.AUTO_POST === 'true',
    dryRun: process.env.DRY_RUN !== 'false', // Default to dry run
    includeScreenshots: false, // Future feature
    enableThreads: true,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logPath: './logs',
  },
};

// Validation
export function validateConfig(): boolean {
  const errors: string[] = [];

  if (!config.features.dryRun) {
    if (!config.twitter.appKey) errors.push('TWITTER_API_KEY is required');
    if (!config.twitter.appSecret) errors.push('TWITTER_API_SECRET is required');
    if (!config.twitter.accessToken) errors.push('TWITTER_ACCESS_TOKEN is required');
    if (!config.twitter.accessSecret) errors.push('TWITTER_ACCESS_SECRET is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    return false;
  }

  return true;
}
