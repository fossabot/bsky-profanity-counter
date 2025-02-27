import dotenv from 'dotenv';
import { ProfanityAnalysis } from './profanity.js';
import * as logger from './logger.js';

dotenv.config();

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Type for cache entries
type CacheEntry = {
  timestamp: number;
  data: ProfanityAnalysis;
};

// Simple in-memory cache
class Cache {
  private cache: Record<string, CacheEntry> = {};

  // Get an item from the cache
  get(key: string): ProfanityAnalysis | null {
    const entry = this.cache[key];

    // If entry doesn't exist or is expired, return null
    if (!entry || Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      return null;
    }

    return entry.data;
  }

  // Set an item in the cache
  set(key: string, data: ProfanityAnalysis): void {
    this.cache[key] = {
      timestamp: Date.now(),
      data
    };
  }

  // Clear expired entries from the cache
  cleanup(): void {
    const now = Date.now();

    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp > CACHE_DURATION_MS) {
        delete this.cache[key];
      }
    });
  }
}

// Export a singleton instance
export const profanityCache = new Cache();
