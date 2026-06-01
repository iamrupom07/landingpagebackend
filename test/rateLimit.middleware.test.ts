import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const limiterState = vi.hoisted(() => ({
  redis: {
    call: vi.fn(async () => {
      throw new Error('redis down');
    }),
  },
}));

vi.mock('../src/config/redis', () => ({
  getRedis: () => limiterState.redis,
}));

import { createRateLimiter } from '../src/middlewares/rateLimit.middleware';

function testApp(failOpenOnStoreError = false) {
  const app = express();
  app.use(
    createRateLimiter({
      name: failOpenOnStoreError ? 'open-test' : 'strict-test',
      windowMs: 60_000,
      max: 1,
      failOpenOnStoreError,
    }),
  );
  app.get('/', (_req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRateLimiter store failure behavior', () => {
  it('keeps login-style limiters strict on Redis store errors', async () => {
    await request(testApp()).get('/').expect(500);
    expect(limiterState.redis.call).toHaveBeenCalled();
  });

  it('can fail open for global and public traffic limiters', async () => {
    await request(testApp(true)).get('/').expect(200);
    expect(limiterState.redis.call).toHaveBeenCalled();
  });
});
