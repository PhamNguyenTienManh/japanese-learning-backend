import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { any } from 'zod';
@Injectable()
export class SearchHistoryService {
  constructor(
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) { }

  async saveSearchTerm(userId: string, searchTerm: string) {
    const key = `user:${userId}:search_history`;
    const term = searchTerm.trim().toLowerCase();

    await this.redisClient.multi()
      .lrem(key, 0, term)
      .lpush(key, term)
      .ltrim(key, 0, 4)
      .expire(key, 60 * 60 * 24 * 7)
      .exec();
    await this.incrementSearchCount(term);
  }

  async getSearchHistory(userId: string) {
    return await this.redisClient.lrange(`user:${userId}:search_history`, 0, 4);
  }
  async deleteSearchTerm(userId: string, searchTerm: string) {
    const key = `user:${userId}:search_history`;
    const term = searchTerm.trim().toLowerCase();
    await this.redisClient.lrem(key, 0, term);
  }
  async incrementSearchCount(searchTerm: string) {
    const key = 'global:search_counts';
    const term = searchTerm.trim().toLowerCase();

    await this.redisClient.zincrby(key, 1, term);
  }
  async getTrendingSearchTerms(limit: number = 5) {
    const key = 'global:search_counts';

    const results = await this.redisClient.zrevrange(
      key,
      0,
      limit - 1,
      'WITHSCORES'
    );

    const trending: any[] = [];
    for (let i = 0; i < results.length; i += 2) {
      trending.push({
        term: results[i],
        count: parseInt(results[i + 1])
      });
    }

    return trending;
  }
}
