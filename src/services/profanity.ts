import type { ProfanityAnalysis } from '../types/index.js';

// A basic list of profanity words - this should be expanded
const PROFANITY_LIST = new Set([
  'fuck', 'shit', 'damn', 'ass', 'bitch',
  'crap', 'piss', 'dick', 'cock', 'pussy',
  'asshole', 'bastard', 'motherfucker',
]);

export function analyzeProfanity(posts: string[]): ProfanityAnalysis {
  const wordCounts = new Map<string, number>();
  let totalProfanity = 0;

  for (const post of posts) {
    // Convert to lowercase and split into words
    const words = post.toLowerCase().split(/\W+/);

    for (const word of words) {
      if (PROFANITY_LIST.has(word)) {
        totalProfanity++;
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  // Find the most frequently used profanity
  let favoriteWord: string | undefined;
  let maxCount = 0;

  for (const [word, count] of wordCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      favoriteWord = word;
    }
  }

  return {
    totalPosts: posts.length,
    profanityCount: totalProfanity,
    favoriteWord: favoriteWord,
    profanityRate: totalProfanity / posts.length,
  };
}
