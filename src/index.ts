import dotenv from 'dotenv';
import { BskyAgent } from '@atproto/api';
import { analyzePosts, generateResponseMessage } from './utils/profanity.js';
import { profanityCache } from './utils/cache.js';

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
    const agent = new BskyAgent({
      service: 'https://bsky.social',
    });

    await agent.login({
      identifier: BLUESKY_IDENTIFIER,
      password: BLUESKY_PASSWORD,
    });

    console.log('Successfully authenticated with Bluesky');

    // Get recent mentions
    const notificationsResponse = await agent.listNotifications({ limit: 20 });
    const mentions = notificationsResponse.data.notifications.filter(
      notification => notification.reason === 'mention' && !notification.isRead
    );

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

        // Safely access nested properties with type assertion
        const record = mention.record as any;
        if (record && record.reply && record.reply.parent) {
          parentUri = record.reply.parent.uri;
        }

        if (!parentUri) {
          console.log('Skipping mention that is not a reply or missing parent URI');
          continue;
        }

        console.log(`Processing parent post: ${parentUri}`);

        try {
          // Parse the URI to get the repo and record key
          const uriParts = parentUri.split('/');
          if (uriParts.length < 5) {
            console.log(`Invalid parent URI format: ${parentUri}`);
            continue;
          }

          const repo = uriParts[2];
          const rkey = uriParts[4];

          // Get the parent post details
          // @ts-ignore - Ignoring TypeScript error for API compatibility
          const parentPostResponse = await agent.app.bsky.feed.getPost({ repo, rkey });

          if (!parentPostResponse.success) {
            console.log(`Failed to get parent post: ${parentUri}`);
            continue;
          }

          // Extract author information
          const authorDid = parentPostResponse.data.post.author.did;
          const authorHandle = parentPostResponse.data.post.author.handle;

          console.log(`Processing mention for author: ${authorHandle} (${authorDid})`);

          // Check if we have a cached result for this author
          let analysis = profanityCache.get(authorDid);

          if (!analysis) {
            console.log(`No cached data found for ${authorHandle}, analyzing posts...`);

            // Get the author's posts
            const allPosts = [];
            let cursor;

            // Fetch posts in batches until we have enough or there are no more
            while (allPosts.length < 100) {
              const postsResponse = await agent.getAuthorFeed({
                actor: authorDid,
                limit: 100,
                cursor,
              });

              const posts = postsResponse.data.feed
                .filter(item => !item.reason) // Filter out reposts
                .map(item => item.post);

              allPosts.push(...posts);

              if (!postsResponse.data.cursor || posts.length === 0) {
                break;
              }

              cursor = postsResponse.data.cursor;
            }

            const posts = allPosts.slice(0, 100);
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

          // Reply to the mention
          await agent.post({
            text: responseMessage,
            reply: {
              root: {
                uri: mention.uri,
                cid: mention.cid,
              },
              parent: {
                uri: mention.uri,
                cid: mention.cid,
              },
            },
          });

          console.log(`Replied to mention with analysis results`);
        } catch (error) {
          console.error(`Error processing parent post ${parentUri}:`, error);
          continue;
        }

      } catch (error) {
        console.error('Error processing mention:', error);
      }
    }

    // Mark notifications as read
    if (notificationIds.length > 0) {
      await agent.updateSeenNotifications(notificationIds[0]);
      console.log(`Marked ${notificationIds.length} notifications as read`);
    }

    // Clean up expired cache entries
    profanityCache.cleanup();

  } catch (error) {
    console.error('Error running the bot:', error);
  }
}

// Run the main function
main();
