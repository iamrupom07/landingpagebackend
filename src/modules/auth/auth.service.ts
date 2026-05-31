import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import type { LoginInput, CreateAdminInput } from './auth.schema';

export class AuthService {
  async login(data: LoginInput) {
    const admin = await (prisma as any).adminUser.findUnique({
      where: { email: data.email },
    });

    if (!admin) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(data.password, admin.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    await (prisma as any).adminUser.update({
      where: { id: admin.id },
      data:  { lastLoginAt: new Date() },
    });

    // Cast expiresIn to any to satisfy strict jsonwebtoken overloads
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      env.JWT_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async createAdmin(data: CreateAdminInput) {
    const existing = await (prisma as any).adminUser.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Admin with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);

    return (prisma as any).adminUser.create({
      data:   { email: data.email, passwordHash, name: data.name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }
}

export const authService = new AuthService();
