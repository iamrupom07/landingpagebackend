import IORedis from 'ioredis';
import { env } from './env';

let redisClient: IORedis | null | undefined;

export function getRedis(): IORedis | null {
  if (!env.REDIS_URL) return null;
  if (redisClient !== undefined) return redisClient;

  redisClient = new IORedis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redisClient.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  return redisClient;
}

export function createBullMqRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required to start BullMQ workers');
  }

  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export function getBullMqConnectionOptions() {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required to start BullMQ workers');
  }

  const url = new URL(env.REDIS_URL);
  const db = url.pathname.replace('/', '');

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: db ? Number(db) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export async function closeRedis(): Promise<void> {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  await client.quit();
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const response = await redis.ping();
  return response === 'PONG';
}
