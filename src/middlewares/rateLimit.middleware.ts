import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis } from '../config/redis';

type LimiterOptions = Partial<Options> & {
  name: string;
};

function redisStore(name: string): RedisStore | undefined {
  const redis = getRedis();
  if (!redis) return undefined;

  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (...args: string[]) => {
      const [command, ...params] = args;
      if (!command) throw new Error('Redis command is required');
      return redis.call(command, ...params) as Promise<string | number | boolean | Array<string | number | boolean>>;
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
