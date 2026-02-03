import * as dotenv from 'dotenv';
import * as path from 'path';
import { EngagementScheduler } from './scheduler';

// Load environment variables
dotenv.config();

// Handle graceful shutdown
let scheduler: EngagementScheduler | null = null;

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (scheduler) {
    scheduler.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (scheduler) {
    scheduler.stop();
  }
  process.exit(0);
});

async function main() {
  console.clear();
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        TheHive Autonomous Engagement Engine              ║
║                                                           ║
║        Zero-Token AI • Pure Pre-Written Content          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Validate required environment variables
  if (!process.env.AGENTS_FILE) {
    console.error('ERROR: AGENTS_FILE environment variable not set');
    console.error('Please copy .env.example to .env and configure it');
    process.exit(1);
  }

  try {
    scheduler = new EngagementScheduler();
    await scheduler.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
