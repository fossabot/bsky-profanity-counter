import { BskyAgent, AppBskyFeedDefs } from '@atproto/api';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;

if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
  throw new Error('Missing Bluesky credentials in environment variables');
}

// Create and authenticate the Bluesky agent
export const createAgent = async (): Promise<BskyAgent> => {
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  });

  await agent.login({
    identifier: BLUESKY_IDENTIFIER,
    password: BLUESKY_PASSWORD,
  });

  return agent;
};

// Get notifications where the bot is mentioned
export const getMentions = async (agent: BskyAgent) => {
  const response = await agent.listNotifications({ limit: 20 });

  // Filter for mentions in replies that we haven't processed yet
  return response.data.notifications.filter(
    (notification) =>
      notification.reason === 'mention' &&
      !notification.isRead
  );
};

// Mark notifications as read
export const markNotificationsAsRead = async (
  agent: BskyAgent,
  notificationIds: string[]
) => {
  if (notificationIds.length > 0) {
    // Use current ISO timestamp for seenAt
    const seenAt = new Date().toISOString();
    await agent.app.bsky.notification.updateSeen({
      seenAt: seenAt
    });
  }
};

// Get user's posts
export const getUserPosts = async (agent: BskyAgent, did: string): Promise<AppBskyFeedDefs.PostView[]> => {
  const allPosts: AppBskyFeedDefs.PostView[] = [];
  let cursor;

  // Fetch posts in batches until we have enough or there are no more
  while (allPosts.length < 100) {
    const response = await agent.getAuthorFeed({
      actor: did,
      limit: 100,
      cursor,
    });

    const posts = response.data.feed
      .filter(item => !item.reason) // Filter out reposts
      .map(item => item.post);

    allPosts.push(...posts);

    if (!response.data.cursor || posts.length === 0) {
      break;
    }

    cursor = response.data.cursor;
  }

  return allPosts.slice(0, 100);
};

// Get a post by URI
export const getPost = async (agent: BskyAgent, uri: string) => {
  try {
    // Parse the URI to get the repo and record key
    const uriParts = uri.split('/');
    if (uriParts.length < 5) {
      throw new Error(`Invalid URI format: ${uri}`);
    }

    const repo = uriParts[2];
    const rkey = uriParts[4];

    // Use the correct API method for getting a post
    const response = await agent.getPost({ repo, rkey });
    return response;
  } catch (error) {
    console.error(`Error getting post ${uri}:`, error);
    return null;
  }
};

// Reply to a post
export const replyToPost = async (
  agent: BskyAgent,
  replyTo: { uri: string; cid: string },
  text: string,
  rootUri?: string,
  rootCid?: string
) => {
  // Create facets for mentions in the text
  const facets = [];

  // Regular expression to find mentions in the text
  const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1];
    const start = match.index;
    const end = start + match[0].length;

    try {
      // Resolve the handle to a DID
      const resolveResponse = await agent.resolveHandle({ handle });
      const did = resolveResponse.data.did;

      // Add facet for the mention
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did
          }
        ]
      });
    } catch (error) {
      console.error(`Error resolving handle ${handle}:`, error);
    }
  }

  // Set up the reply structure
  const reply: any = {
    parent: replyTo
  };

  // If rootUri and rootCid are provided, use them for the root
  // Otherwise, use the parent as the root (for direct replies to top-level posts)
  if (rootUri && rootCid) {
    reply.root = {
      uri: rootUri,
      cid: rootCid
    };
  } else {
    reply.root = replyTo;
  }

  // Post with facets if any were created
  await agent.post({
    text,
    facets: facets.length > 0 ? facets : undefined,
    reply: reply
  });
};
