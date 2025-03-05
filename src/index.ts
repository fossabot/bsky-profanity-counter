import dotenv from 'dotenv';
import { analyzePosts, generateResponseMessage } from './services/profanity.js';
import { profanityCache } from './services/cache.js';
import {
  createAgent,
  getMentions,
  getPost,
  getUserPosts,
  markNotificationsAsRead,
  replyToPost
} from './services/bluesky.js';
import * as logger from './services/logger.js';

// Load environment variables
dotenv.config();

// Environment variables
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || '';
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD || '';

if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
  logger.error('🕵️ Missing Bluesky credentials in environment variables');
  throw new Error('🕵️ Missing Bluesky credentials in environment variables');
}

async function main() {
  logger.info('✨ Starting Bluesky Profanity Counter Bot...');

  try {
    // Create and authenticate the Bluesky agent
    const agent = await createAgent();
    logger.success('✅ Successfully authenticated with Bluesky');

    // Get recent mentions - these are already sorted from oldest to newest
    let mentions = await getMentions(agent);

    if (mentions.length === 0) {
      logger.info('🔍 No new mentions to process');
      return;
    } else {
      logger.info(`✅ Found ${mentions.length} unread mentions to process`);
    }

    // Process mentions one at a time - they're already sorted from oldest to newest
    while (mentions.length > 0) {
      // Take the first mention from the array (which is the oldest unprocessed mention)
      const mention = mentions.shift();

      // Skip if mention is undefined (shouldn't happen, but TypeScript wants this check)
      if (!mention) {
        continue;
      }

      try {
        // Extract the parent URI if this is a reply
        let parentUri = null;
        let rootUri = null;
        let rootCid = null;
        //  For cases where the user just tags the bot in a post (ie "direct mention")
        let isDirectMention = false;
        let authorDid = '';

        // Safely access nested properties with type assertion
        const record = mention.record as any;
        if (record && record.reply) {
          if (record.reply.parent) {
            parentUri = record.reply.parent.uri;
          }

          // Also capture the root if available
          if (record.reply.root) {
            rootUri = record.reply.root.uri;
            rootCid = record.reply.root.cid;
          }
        } else {
          // This is a direct mention (not a reply)
          isDirectMention = true;
          // Use the mention author as the target for analysis
          authorDid = mention.author.did;
          logger.info(`👨‍👩‍👦‍👦 Processing direct mention from: ${authorDid}`);
        }

        if (!parentUri && !isDirectMention) {
          logger.warn(`🔍 Skipping mention that is not a reply or direct mention\n\t- "${mention.uri}"`);
          continue;
        }

        try {
          // For replies, get the parent post author
          if (!isDirectMention) {
            logger.info(`👨‍👩‍👦‍👦 Processing parent post: ${parentUri}`);

            // Get the parent post details using the utility function
            const parentPostResponse = await getPost(agent, parentUri);

            if (!parentPostResponse) {
              logger.error(`❌ Failed to get parent post\n\t- "${parentUri}"`);
              continue;
            }

            // Get the author's DID from the URI
            authorDid = parentPostResponse.uri.split('/')[2];
          }

          // Get the author's profile
          const profileResponse = await agent.getProfile({ actor: authorDid });
          const authorHandle = profileResponse.data.handle;

          logger.info(`🗣️ Processing ${isDirectMention ? 'direct mention' : 'reply mention'} for author: ${authorHandle} (${authorDid})`);

          // Check if we have a cached result for this author
          let analysis = profanityCache.get(authorDid);

          if (!analysis) {
            logger.info(`🔍 No cached data found for ${authorHandle}, analyzing posts...`);

            // Get the author's posts using the utility function
            const posts = await getUserPosts(agent, authorDid);
            logger.info(`🔢 Retrieved ${posts.length} posts for analysis`);

            // Analyze the posts for profanity
            analysis = analyzePosts(posts);

            // Cache the results
            profanityCache.set(authorDid, analysis);

            logger.success(`✅ Analysis complete: ${analysis.totalCount} profanities found`);
          } else {
            logger.info(`🔍 Using cached analysis for ${authorHandle}`);
          }

          // Generate a response message
          const responseMessage = generateResponseMessage(analysis, authorHandle, analysis.postCount);

          // Reply to the mention using the utility function
          await replyToPost(agent, {
            uri: mention.uri,
            cid: mention.cid
          }, responseMessage, rootUri, rootCid);

          logger.success(`✅ Replied to mention with analysis results`);

          // Mark this notification as read immediately after processing
          await markNotificationsAsRead(agent, [mention.uri]);
          logger.success(`✅ Marked notification as read (along with all older notifications)`);

          // Re-fetch unread mentions after each processed notification
          logger.info(`📥 Re-fetching unread mentions...`);
          mentions = await getMentions(agent);
          logger.info(`✅ Found ${mentions.length} unread mentions remaining`);

        } catch (error) {
          console.error(`Error processing parent post ${parentUri}:`, error);
          continue;
        }

      } catch (error) {
        console.error('Error processing mention:', error);
      }
    }

    // Clean up expired cache entries
    profanityCache.cleanup();

  } catch (error) {
    logger.error(`❌ Error running the bot:\n\t- ${error || 'unknown'}`);
  }
}

// Run the main function
main();
