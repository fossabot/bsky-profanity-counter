import { BskyAgent } from '@atproto/api';
import * as bsky from './services/bluesky.js';
import * as db from './services/database.js';
import { Notification } from './types.js';

/**
 * Takes a Bluesky notification and maps it to our database Mention schema structure
 * Fields required by our Prisma Mention model:
 * - userHandle: String (handle of user to analyze)
 * - postId: String (ID of post containing the mention)
 * - postUrl: String (URL to the post)
 * - isReply: Boolean (whether it's a reply or direct mention)
 */
function notificationToMention(notification: Notification) {
  // Extract the userHandle - for direct mentions we analyze the author
  // For replies we analyze the parent post author (this gets set in storeMentions)
  const userHandle = notification.author.handle;

  // Extract post ID from the notification URI
  const postId = notification.uri.split('/').pop() || '';

  // The post URL is the full URI
  const postUrl = notification.uri;

  // Determine if this is a reply by checking the record structure
  const record = notification.record as any;
  const isReply = !!(record?.reply?.parent);

  return {
    userHandle,
    postId,
    postUrl,
    isReply
  };
}

/**
 * Takes each notification from Bluesky, converts it to our Mention format,
 * and stores it in the database.
 */
export default async function storeMentions(agent: BskyAgent, mentions: Notification[]) {
  // Process mentions sequentially to handle parent post lookups properly
  await Promise.all(mentions.map(async (mention) => {
    try {
      // Start with basic mention info
      const mentionData = notificationToMention(mention);

      // If this is a reply, we need to get the parent post author instead
      if (mentionData.isReply) {
        const record = mention.record as any;
        const parentUri = record?.reply?.parent?.uri;
        if (parentUri) {
          try {
            // Get parent post details using the utility function
            const parentPostResponse = await bsky.getPost(agent, parentUri);

            if (parentPostResponse) {
              // Get the author's DID from the URI
              const authorDid = parentPostResponse.uri.split('/')[2];

              // Get the profile of the parent post's author
              const profileResponse = await bsky.getProfile(agent, authorDid);

              // Override the userHandle to be the parent author
              mentionData.userHandle = profileResponse.handle;
            }
          } catch (error) {
            console.error('Error fetching parent post:', error);
            // If we can't get the parent post, we'll keep the original mention author
          }
        }
      }

      // Store in database
      await db.storeMention(mentionData);

    } catch (error) {
      console.error('Error processing mention:', error);
    }
  }));

  // After storing all mentions, mark notifications as read
  if (mentions.length > 0) {
    await bsky.markNotificationsAsRead(agent);
  }
}
