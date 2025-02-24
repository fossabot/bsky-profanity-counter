export interface ProfanityAnalysis {
  totalPosts: number;
  profanityCount: number;
  favoriteWord?: string;
  profanityRate: number;  // profanity per post
}

export interface CachedAnalysis extends ProfanityAnalysis {
  lastAnalyzed: Date;
  handle: string;
}

export interface Config {
  maxPostsToAnalyze: number;
  cacheDurationHours: number;
  blueskyIdentifier: string;
  blueskyPassword: string;
  databaseUrl: string;
}
