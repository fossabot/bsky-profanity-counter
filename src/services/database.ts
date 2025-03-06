import { PrismaClient } from '@prisma/client'

// Type for profanity details stored in JSON
export type ProfanityDetails = {
  // Map of profanity words to counts
  wordCounts: Record<string, number>;
  // Array of top profanities with counts, sorted descending
  topProfanities: Array<{ word: string; count: number }>;
}

// Initialize Prisma client (only once at module level)
const prisma = new PrismaClient();

/**
 * Store a new mention from a notification
 */
export async function storeMention({
  userHandle,
  postId,
  postUrl,
  isReply,
}: {
  userHandle: string;
  postId: string;
  postUrl: string;
  isReply: boolean;
}) {
  return prisma.mention.create({
    data: {
      userHandle,
      postId,
      postUrl,
      isReply,
      // Status defaults to UNPROCESSED
    },
  });
}

/**
 * Get all mentions with UNPROCESSED status
 */
export async function getUnprocessedMentions() {
  return prisma.mention.findMany({
    where: {
      status: 'UNPROCESSED',
    },
  });
}

/**
 * Mark a mention as being analyzed
 */
export async function markMentionAsAnalyzing(mentionId: string) {
  return prisma.mention.update({
    where: { id: mentionId },
    data: { status: 'ANALYZING' },
  });
}

/**
 * Mark a mention as done and store reply information
 */
export async function markMentionAsDone({
  mentionId,
  replyPostId,
  replyUrl,
  analysisId,
}: {
  mentionId: string;
  replyPostId: string;
  replyUrl: string;
  analysisId: string;
}) {
  return prisma.mention.update({
    where: { id: mentionId },
    data: {
      status: 'DONE',
      replyPostId,
      replyUrl,
      analysisId,
    },
  });
}

/**
 * Find a fresh analysis (within 24 hours) for a user
 */
export async function findFreshAnalysis(userHandle: string) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return prisma.analysis.findFirst({
    where: {
      userHandle,
      lastAnalyzedAt: {
        gte: oneDayAgo,
      },
    },
  });
}

/**
 * Create or update analysis for a user
 */
export async function createOrUpdateAnalysis({
  userHandle,
  totalPosts,
  profanityCount,
  profanityDetails,
}: {
  userHandle: string;
  totalPosts: number;
  profanityCount: number;
  profanityDetails: ProfanityDetails;
}) {
  // Try to find existing analysis to update
  const existingAnalysis = await prisma.analysis.findUnique({
    where: { userHandle },
  });

  if (existingAnalysis) {
    return prisma.analysis.update({
      where: { id: existingAnalysis.id },
      data: {
        totalPosts,
        profanityCount,
        profanityDetails,
        lastAnalyzedAt: new Date(),
      },
    });
  }

  // Create new analysis if none exists
  return prisma.analysis.create({
    data: {
      userHandle,
      totalPosts,
      profanityCount,
      profanityDetails,
      // lastAnalyzedAt defaults to now
    },
  });
}

/**
 * Clean up old analyses (optional, for storage management)
 * Removes analyses older than specified days
 */
export async function cleanupOldAnalyses(olderThanDays: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.analysis.deleteMany({
    where: {
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Close the database connection when done
 */
export async function disconnect() {
  await prisma.$disconnect();
}
