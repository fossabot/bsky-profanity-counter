import { config } from 'dotenv';
import { BlueskyService } from './services/bluesky.js';
import type { Config } from './types/index.js';

// Load environment variables
config();

const botConfig: Config = {
  maxPostsToAnalyze: parseInt(process.env.MAX_POSTS_TO_ANALYZE || '100', 10),
  cacheDurationHours: parseInt(process.env.CACHE_DURATION_HOURS || '24', 10),
  blueskyIdentifier: process.env.BLUESKY_IDENTIFIER!,
  blueskyPassword: process.env.BLUESKY_PASSWORD!,
  databaseUrl: process.env.DATABASE_URL!,
};

// Validate required environment variables
if (!botConfig.blueskyIdentifier || !botConfig.blueskyPassword || !botConfig.databaseUrl) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function main() {
  const service = new BlueskyService(botConfig);

  try {
    await service.init();
    console.log('Bot initialized successfully');

    // TODO: Implement notification subscription
    // For now, we can test the functionality by analyzing a specific user
    const analysis = await service.analyzeUser('example.bsky.social');
    console.log('Analysis result:', analysis);
  } catch (error) {
    console.error('Error running bot:', error);
    process.exit(1);
  }
}

main();
