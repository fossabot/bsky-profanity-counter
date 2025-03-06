import dotenv from 'dotenv';
import { analyzePosts, generateResponseMessage, ProfanityAnalysis } from './services/profanity.js';
import {
  createAgent,
  getMentions,
} from './services/bluesky.js';
import * as logger from './services/logger.js';
import * as db from './services/database.js';
import storeMentions from './mentions.js';
import { checkAndProcessMentions } from './analysis.js';

// Load environment variables
dotenv.config();

// Environment variables
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || '';
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD || '';

// Hardcoded bot DID for self-mention detection (no need to fetch it each time)
const BOT_DID = 'did:plc:zq2louqgczh23wrrduwwbvbn';

if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
  logger.error('🕵️ Missing Bluesky credentials in environment variables');
  throw new Error('🕵️ Missing Bluesky credentials in environment variables');
}

async function main() {
  logger.info('🤬 Starting profanity.accountant');

  try {
    // Reset any mentions that have been stuck in ANALYZING state for more than 30 minutes
    const resetCount = await db.resetStuckMentions(30);
    if (resetCount > 0) {
      logger.info(`🔄 Reset ${resetCount} mentions that were stuck in ANALYZING state`);
    }

    // Create and authenticate the Bluesky agent
    const agent = await createAgent();

    logger.info(`🤖 Bot authenticated as: ${BLUESKY_IDENTIFIER} (${BOT_DID})`);

    // STEP 1: Get recent mentions and store them in the database
    logger.info('🗣️ Getting unread mentions from Bluesky...');
    const mentions = await getMentions(agent);

    if (mentions.length === 0) {
      logger.info('🫤 No new mentions to process');
      await db.disconnect();
      return;
    } else {
      logger.info(`✅ Found ${mentions.length} unread mentions to process`);
    }

    //  First thing we do is store the mentions in the database
    await storeMentions(agent, mentions);

    // Now we check for unanalyzed mentions and process them
    await checkAndProcessMentions(agent);
  } catch (error) {
    logger.error(`❌ Error running the bot:\n\t- ${error}`);
    await db.disconnect();
  }
}

// Run the main function
main();
