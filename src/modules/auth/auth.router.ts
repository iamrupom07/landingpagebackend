import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/async.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.post('/login', loginLimiter, asyncHandler(authController.login.bind(authController)));
router.get('/me',    authMiddleware, asyncHandler(authController.me.bind(authController)));
router.post('/admin', authMiddleware, asyncHandler(authController.createAdmin.bind(authController)));

export default router;
