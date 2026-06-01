import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { enqueueEmailJob } from '../email/email.queue';
import { setCachedAdminTokenVersion } from './auth.cache';
import type {
  ChangePasswordInput,
  CreateAdminInput,
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
} from './auth.schema';

function signAdminToken(admin: { id: string; email: string; tokenVersion: number }): string {
  return jwt.sign(
    { id: admin.id, email: admin.email, tokenVersion: admin.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  );
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(token: string): string {
  const url = new URL('/reset-password', env.ADMIN_APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export class AuthService {
  async login(data: LoginInput) {
    const admin = await prisma.adminUser.findUnique({
      where: { email: data.email },
    });

    if (!admin) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(data.password, admin.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signAdminToken(updated);
    await setCachedAdminTokenVersion(updated.id, updated.tokenVersion);

    return {
      token,
      user: { id: updated.id, email: updated.email, name: updated.name },
    };
  }

  async createAdmin(data: CreateAdminInput) {
    const existing = await prisma.adminUser.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Admin with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);

    return prisma.adminUser.create({
      data: { email: data.email, passwordHash, name: data.name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }

  async logoutAll(adminId: string): Promise<void> {
    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: { tokenVersion: { increment: 1 } },
    });
    await setCachedAdminTokenVersion(updated.id, updated.tokenVersion);
  }

  async changePassword(adminId: string, data: ChangePasswordInput): Promise<void> {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new Error('Admin not found');

    const valid = await bcrypt.compare(data.currentPassword, admin.passwordHash);
    if (!valid) throw new Error('Invalid current password');

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });
    await setCachedAdminTokenVersion(updated.id, updated.tokenVersion);
  }

  async requestPasswordReset(data: PasswordResetRequestInput): Promise<void> {
    const admin = await prisma.adminUser.findUnique({ where: { email: data.email } });
    if (!admin) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000);

    await prisma.passwordResetToken.deleteMany({
      where: {
        adminUserId: admin.id,
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        adminUserId: admin.id,
        tokenHash,
        expiresAt,
      },
    });

    await enqueueEmailJob({
      type: 'password-reset',
      recipient: admin.email,
      adminName: admin.name,
      resetUrl: buildResetUrl(token),
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to queue password reset email:', message);
    });
  }

  async confirmPasswordReset(data: PasswordResetConfirmInput): Promise<void> {
    const tokenHash = hashResetToken(data.token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const consumed = await prisma.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) throw new Error('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    const updated = await prisma.adminUser.update({
      where: { id: resetToken.adminUserId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });
    await setCachedAdminTokenVersion(updated.id, updated.tokenVersion);
  }
}

export const authService = new AuthService();
