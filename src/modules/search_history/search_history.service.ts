import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';
@Injectable()
export class SearchHistoryService {
  constructor(
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {}

  async saveSearchTerm(userId: string, searchTerm: string) {
    console.log("userId", userId);
    
    console.log("searchTerm", searchTerm);
    
    
    const key = `user:${userId}:search_history`;
    const term = searchTerm.trim().toLowerCase();

    await this.redisClient.multi()
      .lrem(key, 0, term)
      .lpush(key, term)
      .ltrim(key, 0, 4)
      .expire(key, 60 * 60 * 24 * 7)
      .exec();
  }

  async getSearchHistory(userId: string) {
    return await this.redisClient.lrange(`user:${userId}:search_history`, 0, 4);
  }
  async deleteSearchTerm(userId: string, searchTerm: string) {
    const key = `user:${userId}:search_history`;
    const term = searchTerm.trim().toLowerCase();
    await this.redisClient.lrem(key, 0, term);
  }
}
