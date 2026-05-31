import { describe, expect, it, vi } from 'vitest';

const queueState = vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'x'.repeat(64);
  delete process.env.REDIS_URL;

  return {
    processJob: vi.fn(async () => undefined),
  };
});

vi.mock('../src/modules/email/email.service', () => ({
  emailService: { processJob: queueState.processJob },
}));

import { enqueueEmailJob } from '../src/modules/email/email.queue';

describe('email queue fallback', () => {
  it('runs email jobs directly when Redis is not configured', async () => {
    await expect(
      enqueueEmailJob({
        type: 'password-reset',
        recipient: 'admin@example.com',
        adminName: 'Admin',
        resetUrl: 'http://localhost:3000/reset-password?token=abc',
      }),
    ).resolves.toEqual({ queued: false });

    expect(queueState.processJob).toHaveBeenCalledOnce();
  });
});
