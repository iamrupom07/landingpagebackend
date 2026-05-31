import { getRedis } from '../config/redis';

export class CacheService {
  async getJson<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;

    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    await redis.del(key);
  }
}

export const cacheService = new CacheService();
