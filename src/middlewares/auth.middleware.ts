import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import {
  getCachedAdminTokenVersion,
  setCachedAdminTokenVersion,
} from '../modules/auth/auth.cache';

export interface AuthRequest extends Request {
  admin?: { id: string; email: string; tokenVersion: number };
}

type AdminJwtPayload = JwtPayload & {
  id?: string;
  email?: string;
  tokenVersion?: number;
};

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers['authorization'];

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
    if (!decoded.id || !decoded.email || typeof decoded.tokenVersion !== 'number') {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    const cachedTokenVersion = await getCachedAdminTokenVersion(decoded.id);
    if (cachedTokenVersion != null) {
      if (cachedTokenVersion !== decoded.tokenVersion) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }

      req.admin = {
        id: decoded.id,
        email: decoded.email,
        tokenVersion: cachedTokenVersion,
      };
      next();
      return;
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, tokenVersion: true },
    });

    if (!admin || admin.email !== decoded.email || admin.tokenVersion !== decoded.tokenVersion) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    await setCachedAdminTokenVersion(admin.id, admin.tokenVersion);
    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
