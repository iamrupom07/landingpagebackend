import { describe, expect, it, vi } from 'vitest';

const redisQueueState = vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'x'.repeat(64);
  process.env.REDIS_URL = 'redis://localhost:6379';

  const state = {
    add: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    queueCtor: vi.fn(),
  };

  state.queueCtor.mockImplementation(function (_name: string, options: unknown) {
    return {
      add: state.add,
      close: state.close,
      options,
    };
  });

  return state;
});

vi.mock('bullmq', () => ({
  Queue: redisQueueState.queueCtor,
}));

vi.mock('../src/modules/email/email.service', () => ({
  emailService: { processJob: vi.fn() },
}));

import { enqueueEmailJob } from '../src/modules/email/email.queue';

describe('email queue retry settings', () => {
  it('configures BullMQ jobs with retries and exponential backoff', async () => {
    await enqueueEmailJob({
      type: 'password-reset',
      recipient: 'admin@example.com',
      adminName: 'Admin',
      resetUrl: 'http://localhost:3000/reset-password?token=abc',
    });

    const options = redisQueueState.queueCtor.mock.calls[0][1] as any;
    expect(options.defaultJobOptions.attempts).toBe(3);
    expect(options.defaultJobOptions.backoff).toEqual({ type: 'exponential', delay: 1000 });
    expect(redisQueueState.add).toHaveBeenCalledWith('password-reset', expect.objectContaining({ type: 'password-reset' }));
  });
});
