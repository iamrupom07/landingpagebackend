import { getRedis } from '../config/redis';

export class CacheService {
  async getJson<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;

    let value: string | null;
    try {
      value = await redis.get(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read cache key "${key}":`, message);
      return null;
    }

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to parse cache key "${key}":`, message);
      await redis.del(key).catch(() => undefined);
      return null;
    }
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
