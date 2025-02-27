import dotenv from 'dotenv';
import { BskyAgent } from '@atproto/api';
import { analyzePosts, generateResponseMessage } from './utils/profanity.js';
import { profanityCache } from './utils/cache.js';
import {
  createAgent,
  getMentions,
  getPost,
  getUserPosts,
  markNotificationsAsRead,
  replyToPost
} from './utils/bluesky.js';

// Load environment variables
dotenv.config();

// Environment variables
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || '';
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD || '';

if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
  throw new Error('Missing Bluesky credentials in environment variables');
}

async function main() {
  console.log('Starting Bluesky Profanity Counter Bot...');

  try {
    // Create and authenticate the Bluesky agent
    const agent = await createAgent();
    console.log('Successfully authenticated with Bluesky');

    // Get recent mentions
    const mentions = await getMentions(agent);
    console.log(`Found ${mentions.length} unread mentions`);

    if (mentions.length === 0) {
      console.log('No new mentions to process');
      return;
    }

    // Process each mention
    const notificationIds = [];

    for (const mention of mentions) {
      try {
        notificationIds.push(mention.uri);

        // Extract the parent URI if this is a reply
        let parentUri = null;
        let rootUri = null;
        let rootCid = null;

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
        }

        if (!parentUri) {
          console.log('Skipping mention that is not a reply or missing parent URI');
          continue;
        }

        console.log(`Processing parent post: ${parentUri}`);

        try {
          // Get the parent post details using the utility function
          const parentPostResponse = await getPost(agent, parentUri);

          if (!parentPostResponse) {
            console.log(`Failed to get parent post: ${parentUri}`);
            continue;
          }

          // Get the author's DID from the URI
          const authorDid = parentPostResponse.uri.split('/')[2];

          // Get the author's profile
          const profileResponse = await agent.getProfile({ actor: authorDid });
          const authorHandle = profileResponse.data.handle;

          console.log(`Processing mention for author: ${authorHandle} (${authorDid})`);

          // Check if we have a cached result for this author
          let analysis = profanityCache.get(authorDid);

          if (!analysis) {
            console.log(`No cached data found for ${authorHandle}, analyzing posts...`);

            // Get the author's posts using the utility function
            const posts = await getUserPosts(agent, authorDid);
            console.log(`Retrieved ${posts.length} posts for analysis`);

            // Analyze the posts for profanity
            analysis = analyzePosts(posts);

            // Cache the results
            profanityCache.set(authorDid, analysis);

            console.log(`Analysis complete: ${analysis.totalCount} profanities found`);
          } else {
            console.log(`Using cached analysis for ${authorHandle}`);
          }

          // Generate a response message
          const responseMessage = generateResponseMessage(analysis, authorHandle);

          // Reply to the mention using the utility function
          await replyToPost(agent, {
            uri: mention.uri,
            cid: mention.cid
          }, responseMessage, rootUri, rootCid);

          console.log(`Replied to mention with analysis results`);
        } catch (error) {
          console.error(`Error processing parent post ${parentUri}:`, error);
          continue;
        }

      } catch (error) {
        console.error('Error processing mention:', error);
      }
    }

    // Mark notifications as read using the utility function
    await markNotificationsAsRead(agent, notificationIds);
    console.log(`Marked ${notificationIds.length} notifications as read`);

    // Clean up expired cache entries
    profanityCache.cleanup();

  } catch (error) {
    console.error('Error running the bot:', error);
  }
}

// Run the main function
main();
