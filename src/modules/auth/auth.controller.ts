import type { Request, Response } from 'express';
import { authService } from './auth.service';
import {
  changePasswordSchema,
  createAdminSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from './auth.schema';
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
    const admin = await prisma.adminUser.findUnique({
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

  async logoutAll(req: AuthRequest, res: Response) {
    await authService.logoutAll(req.admin!.id);
    return res.json({ success: true, message: 'All sessions revoked' });
  }

  async changePassword(req: AuthRequest, res: Response) {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    await authService.changePassword(req.admin!.id, parsed.data);
    return res.json({ success: true, message: 'Password changed successfully' });
  }

  async requestPasswordReset(req: Request, res: Response) {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    await authService.requestPasswordReset(parsed.data);
    return res.json({
      success: true,
      message: 'If an admin account exists for that email, a reset link has been sent.',
    });
  }

  async confirmPasswordReset(req: Request, res: Response) {
    const parsed = passwordResetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    await authService.confirmPasswordReset(parsed.data);
    return res.json({ success: true, message: 'Password reset successfully' });
  }
}

export const authController = new AuthController();
