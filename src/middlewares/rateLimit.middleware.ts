import rateLimit, { type Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../config/redis";

type LimiterOptions = Partial<Options> & {
  name: string;
};

function redisStore(name: string): RedisStore | undefined {
  const redis = getRedis();
  if (!redis) return undefined;

  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: async (...args: string[]) => {
      const [command, ...params] = args;
      if (!command) throw new Error("Redis command is required");
      const result = await (redis.call(command, ...params) as Promise<unknown>);
      return result as number | string | string[];
    },
  });
}

export function createRateLimiter(options: LimiterOptions) {
  const { name, ...rest } = options;

  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: false,
    store: redisStore(name),
    ...rest,
  });
}
