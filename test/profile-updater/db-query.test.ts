import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import { getTotalProfanityCount, formatNumber, disconnect } from '../../src/services/profile-updater.js';

// Load environment variables
dotenv.config();

describe('Profile Updater Database', () => {
  it('should get total profanity count from database', async () => {
    const totalCount = await getTotalProfanityCount();
    
    // Should be a non-negative number
    expect(totalCount).toBeGreaterThanOrEqual(0);
    expect(typeof totalCount).toBe('number');
    
    // Should format properly
    const formatted = formatNumber(totalCount);
    expect(typeof formatted).toBe('string');
    
    // Clean up
    await disconnect();
  });
});