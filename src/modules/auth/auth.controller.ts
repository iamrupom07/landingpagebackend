import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { loginSchema, createAdminSchema } from './auth.schema';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../db/prisma';

export class AuthController {
  async login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    const result = await authService.login(parsed.data);
    return res.json({ success: true, data: result });
  }

  async me(req: AuthRequest, res: Response) {
    const admin = await (prisma as any).adminUser.findUnique({
      where:  { id: req.admin!.id },
      select: { id: true, email: true, name: true, createdAt: true, lastLoginAt: true },
    });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    return res.json({ success: true, data: admin });
  }

  async createAdmin(req: Request, res: Response) {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }
    const admin = await authService.createAdmin(parsed.data);
    return res.status(201).json({ success: true, data: admin });
  }
}

export const authController = new AuthController();
