import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

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
    if (!decoded.id || !decoded.email || decoded.tokenVersion == null) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
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

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
