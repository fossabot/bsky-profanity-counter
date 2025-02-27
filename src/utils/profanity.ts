import { AppBskyFeedDefs } from '@atproto/api';
import BAD_WORDS from '../data/badWords.js';

// Type for profanity analysis results
export type ProfanityAnalysis = {
  totalCount: number;
  wordCounts: Record<string, number>;
  mostUsed: {
    word: string;
    count: number;
  } | null;
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

  // Find most used profanity
  let mostUsed = null;
  let highestCount = 0;

  Object.entries(totalWordCounts).forEach(([word, count]) => {
    if (count > highestCount) {
      mostUsed = { word, count };
      highestCount = count;
    }
  });

  return {
    totalCount,
    wordCounts: totalWordCounts,
    mostUsed
  };
};

// Generate a response message based on the analysis
export const generateResponseMessage = (analysis: ProfanityAnalysis, username: string): string => {
  if (analysis.totalCount === 0) {
    return `@${username} has been a good citizen!\nNo profanity found in their posts.`;
  }

  let message = `@${username} has swears! They've used ${analysis.totalCount} profanities in their posts.`;

  if (analysis.mostUsed) {
    message += `\n\n📌 Their favorite is "${analysis.mostUsed.word}" (${analysis.mostUsed.count} times).`;
  }

  return message;
};
