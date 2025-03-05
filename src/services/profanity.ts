import { AppBskyFeedDefs } from '@atproto/api';
import BAD_WORDS from '../data/badWords.js';

// Type for profanity analysis results
export type ProfanityAnalysis = {
  totalCount: number;
  wordCounts: Record<string, number>;
  topThree: {
    word: string;
    count: number;
    rank: number; // 1, 2, or 3
  }[];
  postCount: number; // Number of posts analyzed
};

// Analyze text for profanities
export const analyzeProfanity = (text: string): Record<string, number> => {
  const wordCounts: Record<string, number> = {};

  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();

  // Check for each profanity in the text
  BAD_WORDS.forEach(word => {
    // Create a regex that matches the word as a whole word
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lowerText.match(regex);

    if (matches) {
      wordCounts[word] = matches.length;
    }
  });

  return wordCounts;
};

// Analyze a collection of posts for profanities
export const analyzePosts = (posts: AppBskyFeedDefs.PostView[]): ProfanityAnalysis => {
  const totalWordCounts: Record<string, number> = {};

  // Process each post
  posts.forEach(post => {
    // Try to extract text from the post record
    let text = '';

    // The record property might be any type, so we need to use type assertions
    const record = post.record as any;
    if (record && typeof record.text === 'string') {
      text = record.text;
    }

    if (text) {
      const postCounts = analyzeProfanity(text);

      // Add counts to the total
      Object.entries(postCounts).forEach(([word, count]) => {
        totalWordCounts[word] = (totalWordCounts[word] || 0) + count;
      });
    }
  });

  // Calculate total count
  const totalCount = Object.values(totalWordCounts).reduce((sum, count) => sum + count, 0);

  // Find top three most used profanities
  const topThree: { word: string; count: number; rank: number }[] = [];

  // Sort all word counts in descending order
  const sortedEntries = Object.entries(totalWordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // Take only the top 3

  // Create the top three array with ranks
  sortedEntries.forEach(([word, count], index) => {
    topThree.push({
      word,
      count,
      rank: index + 1 // Rank 1, 2, or 3
    });
  });

  return {
    totalCount,
    wordCounts: totalWordCounts,
    topThree,
    postCount: posts.length // Add the number of posts that were analyzed
  };
};

// Generate a response message based on the analysis
export const generateResponseMessage = (analysis: ProfanityAnalysis, username: string, postCount: number): string => {
  if (analysis.totalCount === 0) {
    return `@${username} has been a good citizen!\nNo profanity found in their last ${postCount.toLocaleString('en-CA')} posts.`;
  }

  let message = `@${username} has swears! They've used ${analysis.totalCount.toLocaleString('en-CA')} profanities in their last ${postCount.toLocaleString('en-CA')} posts.`;

  // Add top three profanities with medal emojis if available
  if (analysis.topThree.length > 0) {
    message += "\n\n";

    analysis.topThree.forEach(item => {
      let medal = '';
      switch (item.rank) {
        case 1:
          medal = '🥇';
          break;
        case 2:
          medal = '🥈';
          break;
        case 3:
          medal = '🥉';
          break;
      }

      message += `${medal} "${item.word}" (${item.count.toLocaleString('en-CA')} times)\n`;
    });
  }

  return message;
};
