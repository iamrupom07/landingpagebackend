import { describe, expect, it, vi } from 'vitest';

const mailState = vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'x'.repeat(64);
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'mailer@example.com';
  process.env.SMTP_PASS = 'secret';

  return {
    sendMail: vi.fn(async () => {
      throw new Error('smtp down');
    }),
    emailLogCreate: vi.fn(async () => undefined),
  };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mailState.sendMail,
      verify: vi.fn(async () => true),
    })),
  },
}));

vi.mock('../src/db/prisma', () => ({
  prisma: {
    emailLog: { create: mailState.emailLogCreate },
  },
}));

import { emailService } from '../src/modules/email/email.service';

describe('email failure logging', () => {
  it('records a failed EmailLog entry when a custom email exhausts sending', async () => {
    await expect(
      emailService.sendCustomEmail(
        {
          id: 'lead-1',
          businessName: 'Acme Co',
          businessAddress: '123 Main St',
          contactName: 'Ada Lovelace',
          phone: '5551234567',
          email: 'ada@example.com',
          currentProvider: 'Fiber Co',
          createdAt: new Date().toISOString(),
        },
        'Hello',
        'Body',
      ),
    ).rejects.toThrow('smtp down');

    expect(mailState.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        type: 'custom',
        status: 'failed',
        errorMessage: 'smtp down',
      }),
    });
  });
});
