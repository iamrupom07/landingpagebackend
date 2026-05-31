import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '5000';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'x'.repeat(64);
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.ADMIN_APP_URL = 'http://localhost:3000';
  process.env.MAX_EXPORT_ROWS = '1';
  delete process.env.REDIS_URL;

  type Admin = {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    tokenVersion: number;
    createdAt: Date;
    lastLoginAt: Date | null;
  };

  const admin: Admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    passwordHash: '',
    name: 'Admin',
    tokenVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lastLoginAt: null,
  };

  const resetTokens = new Map<string, any>();

  const pick = (select: Record<string, boolean> | undefined) => {
    if (!select) return { ...admin };
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => enabled)
        .map(([key]) => [key, admin[key as keyof Admin]]),
    );
  };

  const prisma = {
    adminUser: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        if (where.email && where.email !== admin.email) return null;
        if (where.id && where.id !== admin.id) return null;
        return pick(select);
      }),
      update: vi.fn(async ({ data, select }: any) => {
        if (data.lastLoginAt) admin.lastLoginAt = data.lastLoginAt;
        if (data.passwordHash) admin.passwordHash = data.passwordHash;
        if (data.tokenVersion?.increment) admin.tokenVersion += data.tokenVersion.increment;
        return pick(select);
      }),
      create: vi.fn(async ({ data, select }: any) => pick(select) ?? data),
    },
    passwordResetToken: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: `reset-${resetTokens.size + 1}`,
          ...data,
          usedAt: null,
          createdAt: new Date(),
          adminUser: admin,
        };
        resetTokens.set(data.tokenHash, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => resetTokens.get(where.tokenHash) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = [...resetTokens.values()].find((token) => token.id === where.id);
        if (!row || row.usedAt || row.expiresAt <= where.expiresAt.gt) return { count: 0 };
        row.usedAt = data.usedAt;
        return { count: 1 };
      }),
    },
    lead: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(async () => []),
    $disconnect: vi.fn(),
  };

  return {
    admin,
    prisma,
    resetTokens,
    enqueueEmailJob: vi.fn(async () => ({ queued: true })),
  };
});

vi.mock('../src/db/prisma', () => ({
  prisma: testState.prisma,
  closePrisma: vi.fn(),
}));

vi.mock('../src/modules/email/email.queue', () => ({
  enqueueEmailJob: testState.enqueueEmailJob,
  closeEmailQueue: vi.fn(),
}));

import app from '../src/app';
import { cacheService } from '../src/services/cache.service';
import { leadsService, type LeadSummary } from '../src/modules/leads/leads.service';

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    businessName: 'Acme Co',
    businessAddress: '123 Main St',
    contactName: 'Ada Lovelace',
    phone: '5551234567',
    email: 'ada@example.com',
    currentProvider: 'Fiber Co',
    interestedPlan: 'STARTER',
    employeeCount: 12,
    comments: null,
    status: 'NEW',
    source: 'form',
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

async function loginToken(): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: testState.admin.email, password: 'Secret123!' });
  return response.body.data.token;
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.admin.passwordHash = bcrypt.hashSync('Secret123!', 12);
  testState.admin.tokenVersion = 0;
  testState.admin.lastLoginAt = null;
  testState.resetTokens.clear();
  testState.prisma.lead.findMany.mockResolvedValue([leadRow()]);
  testState.prisma.lead.create.mockResolvedValue(leadRow());
});

describe('auth production hardening', () => {
  it('rejects a token after logout-all increments tokenVersion', async () => {
    const token = await loginToken();

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('creates and consumes password reset tokens without user enumeration', async () => {
    await request(app)
      .post('/api/auth/password-reset/request')
      .send({ email: testState.admin.email })
      .expect(200);

    const job = testState.enqueueEmailJob.mock.calls[0][0];
    expect(job.type).toBe('password-reset');

    const token = new URL(job.resetUrl).searchParams.get('token')!;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    expect(testState.resetTokens.has(tokenHash)).toBe(true);

    await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, newPassword: 'NewSecret123!' })
      .expect(200);

    expect(testState.admin.tokenVersion).toBe(1);
    expect(testState.resetTokens.get(tokenHash).usedAt).toBeInstanceOf(Date);
  });
});

describe('lead performance safeguards', () => {
  it('streams CSV exports with a truncation header when more rows exist than the cap', async () => {
    const token = await loginToken();

    const response = await request(app)
      .get('/api/leads/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.headers['x-export-truncated']).toBe('true');
    expect(response.text).toContain('businessName');
    expect(response.text).toContain('Acme Co');
    expect(response.text.trim().split('\n')).toHaveLength(2);
  });

  it('uses cached analytics summaries and writes cache on misses', async () => {
    const cached: LeadSummary = {
      total: 1,
      new: 1,
      contacted: 0,
      qualified: 0,
      closed_won: 0,
      closed_lost: 0,
      byPlan: { starter: 1, professional: 0, enterprise: 0 },
      recentCount: 1,
      formCount: 1,
      manualCount: 0,
      conversionRate: 0,
    };

    const getSpy = vi.spyOn(cacheService, 'getJson').mockResolvedValueOnce(cached);
    await expect(leadsService.getSummary()).resolves.toEqual(cached);
    expect(testState.prisma.$queryRaw).not.toHaveBeenCalled();
    getSpy.mockRestore();

    vi.spyOn(cacheService, 'getJson').mockResolvedValueOnce(null);
    const setSpy = vi.spyOn(cacheService, 'setJson').mockResolvedValueOnce();
    testState.prisma.$queryRaw.mockResolvedValueOnce([
      {
        total: 2,
        new_count: 1,
        contacted_count: 1,
        qualified_count: 0,
        closed_won_count: 0,
        closed_lost_count: 0,
        starter_count: 1,
        professional_count: 1,
        enterprise_count: 0,
        recent_count: 2,
        form_count: 2,
        manual_count: 0,
      },
    ]);

    await expect(leadsService.getSummary()).resolves.toMatchObject({ total: 2, contacted: 1 });
    expect(setSpy).toHaveBeenCalledWith('analytics:summary', expect.objectContaining({ total: 2 }), 60);
  });

  it('invalidates summary cache after lead creation', async () => {
    const deleteSpy = vi.spyOn(cacheService, 'delete').mockResolvedValueOnce();

    await leadsService.create({
      businessName: 'Acme Co',
      businessAddress: '123 Main St',
      contactName: 'Ada Lovelace',
      phone: '5551234567',
      email: 'ada@example.com',
      currentProvider: 'Fiber Co',
    });

    expect(deleteSpy).toHaveBeenCalledWith('analytics:summary');
  });
});
