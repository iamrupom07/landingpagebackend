import IORedis from "ioredis";
import { env } from "./env";

let redisClient: IORedis | null | undefined;

export function getRedis(): IORedis | null {
  if (!env.REDIS_URL) return null;
  if (redisClient !== undefined) return redisClient;

  redisClient = new IORedis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redisClient.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  return redisClient;
}

export function createBullMqRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required to start BullMQ workers");
  }

  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export function getBullMqConnectionOptions() {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required to start BullMQ workers");
  }

  const url = new URL(env.REDIS_URL);
  // FIX: url.pathname is always at least '/', so strip the leading slash.
  // Use slice(1) instead of replace('/','') — replace() only removes the
  // first occurrence and leaves multi-segment paths like '/0/extra' broken.
  const dbStr = url.pathname.slice(1);

  return {
    host: url.hostname,
    // FIX: url.port is an empty string when no port is specified in the URL.
    // `Number('') === 0` which is wrong; fall back to 6379 explicitly.
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: dbStr ? Number(dbStr) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
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
  return response === "PONG";
}
