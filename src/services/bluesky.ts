import { BskyAgent, RichText } from '@atproto/api';
import { PrismaClient } from '@prisma/client';
import type { Config, ProfanityAnalysis } from '../types/index.js';
import { analyzeProfanity } from './profanity.js';

export class BlueskyService {
  private agent: BskyAgent;
  private prisma: PrismaClient;
  private config: Config;

  constructor(config: Config) {
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
    this.prisma = new PrismaClient();
    this.config = config;
  }

  async init() {
    await this.agent.login({
      identifier: this.config.blueskyIdentifier,
      password: this.config.blueskyPassword,
    });
  }

  async getCachedAnalysis(handle: string) {
    const cached = await this.prisma.userProfanityStats.findFirst({
      where: { handle },
    });

    if (!cached) return null;

    const cacheAge = Date.now() - cached.lastAnalyzed.getTime();
    const cacheExpiry = this.config.cacheDurationHours * 60 * 60 * 1000;

    if (cacheAge > cacheExpiry) return null;

    return {
      handle: cached.handle,
      totalPosts: cached.totalPosts,
      profanityCount: cached.profanityCount,
      favoriteWord: cached.favoriteWord,
      profanityRate: cached.profanityCount / cached.totalPosts,
      lastAnalyzed: cached.lastAnalyzed,
    };
  }

  async analyzeUser(handle: string): Promise<ProfanityAnalysis> {
    const cached = await this.getCachedAnalysis(handle);
    if (cached) return cached;

    const profile = await this.agent.getProfile({ actor: handle });
    const posts = await this.fetchUserPosts(profile.data.did);
    const analysis = analyzeProfanity(posts);

    // Cache the results
    await this.prisma.userProfanityStats.upsert({
      where: { id: profile.data.did },
      create: {
        id: profile.data.did,
        handle,
        totalPosts: analysis.totalPosts,
        profanityCount: analysis.profanityCount,
        favoriteWord: analysis.favoriteWord,
        lastAnalyzed: new Date(),
      },
      update: {
        totalPosts: analysis.totalPosts,
        profanityCount: analysis.profanityCount,
        favoriteWord: analysis.favoriteWord,
        lastAnalyzed: new Date(),
      },
    });

    return analysis;
  }

  private async fetchUserPosts(did: string): Promise<string[]> {
    const posts: string[] = [];
    let cursor: string | undefined;

    while (posts.length < this.config.maxPostsToAnalyze) {
      const response = await this.agent.getAuthorFeed({
        actor: did,
        cursor,
        limit: 100,
      });

      const newPosts = response.data.feed
        .filter(item => !item.post.record.reply) // Exclude replies
        .map(item => item.post.record.text);

      posts.push(...newPosts);

      if (!response.data.cursor) break;
      cursor = response.data.cursor;
    }

    return posts.slice(0, this.config.maxPostsToAnalyze);
  }

  async respondToMention(replyTo: { uri: string; cid: string }, analysis: ProfanityAnalysis) {
    const text = this.formatAnalysisResponse(analysis);
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);

    await this.agent.post({
      text: rt.text,
      facets: rt.facets,
      reply: {
        root: { uri: replyTo.uri, cid: replyTo.cid },
        parent: { uri: replyTo.uri, cid: replyTo.cid },
      },
    });
  }

  private formatAnalysisResponse(analysis: ProfanityAnalysis): string {
    if (analysis.profanityCount === 0) {
      return `This user has never cursed in their last ${analysis.totalPosts} posts! 😇`;
    }

    const response = [
      `This user has used ${analysis.profanityCount} curse words in their last ${analysis.totalPosts} posts`,
      `(that's about ${(analysis.profanityRate * 100).toFixed(1)}% of their posts)`,
    ];

    if (analysis.favoriteWord) {
      response.push(`Their favorite curse word is "${analysis.favoriteWord}"`);
    }

    return response.join('\n');
  }
}
