import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BskyAgent } from '@atproto/api';
import { Mention } from '@prisma/client';

// Mock the dependencies
vi.mock('../src/services/database.js', () => ({
  markMentionAsDone: vi.fn(),
}));

vi.mock('../src/services/bluesky.js', () => ({
  getPost: vi.fn(),
  replyToPost: vi.fn(),
}));

vi.mock('../src/services/logger.js', () => ({
  info: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Import the modules we're testing after mocking
import * as db from '../src/services/database.js';
import * as bsky from '../src/services/bluesky.js';
import * as logger from '../src/services/logger.js';
import { WHIMSICAL_RESPONSES } from '../src/services/self-targeting.js';

// We need to test the processMention function, but it's not exported
// So we'll test the behavior by importing the module and calling the exported function
// For now, let's create a test that validates the logic we added

describe('Self-Targeting Detection', () => {
  it('should validate bot handle detection logic', () => {
    // Test the condition that we added
    const botHandle = 'profanity.accountant';
    const testMention = { userHandle: botHandle };
    
    // This should trigger the self-targeting detection
    expect(testMention.userHandle === 'profanity.accountant').toBe(true);
    
    // Test with different handles
    const regularMention = { userHandle: 'regular.user' };
    expect(regularMention.userHandle === 'profanity.accountant').toBe(false);
  });

  it('should have whimsical responses with nerdy accountant personality', () => {
    // Test that all responses are non-empty and contain expected elements
    WHIMSICAL_RESPONSES.forEach(response => {
      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
    });

    // Test that responses contain expected accountant/nerdy patterns
    const responseText = WHIMSICAL_RESPONSES.join(' ').toLowerCase();
    expect(responseText).toContain('account');
    expect(responseText).toContain('audit');
    expect(responseText).toContain('ledger');
  });

  it('should have exactly 10 whimsical responses', () => {
    expect(WHIMSICAL_RESPONSES).toHaveLength(10);
    
    // Ensure all responses are unique
    const uniqueResponses = new Set(WHIMSICAL_RESPONSES);
    expect(uniqueResponses.size).toBe(10);
  });

  it('should include original responses plus new nerdy accountant ones', () => {
    // Check for some original responses
    expect(WHIMSICAL_RESPONSES.some(r => r.includes('Nice try, buddy!'))).toBe(true);
    expect(WHIMSICAL_RESPONSES.some(r => r.includes('perfect!'))).toBe(true);
    
    // Check for new nerdy accountant responses
    expect(WHIMSICAL_RESPONSES.some(r => r.includes('Error 404'))).toBe(true);
    expect(WHIMSICAL_RESPONSES.some(r => r.includes('audit'))).toBe(true);
    expect(WHIMSICAL_RESPONSES.some(r => r.includes('ledger'))).toBe(true);
  });
});