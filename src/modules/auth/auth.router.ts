import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/async.middleware';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware';

const router = Router();

const loginLimiter = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.post('/login', loginLimiter, asyncHandler(authController.login.bind(authController)));
router.post('/password-reset/request', loginLimiter, asyncHandler(authController.requestPasswordReset.bind(authController)));
router.post('/password-reset/confirm', loginLimiter, asyncHandler(authController.confirmPasswordReset.bind(authController)));
router.get('/me', authMiddleware, asyncHandler(authController.me.bind(authController)));
router.post('/logout-all', authMiddleware, asyncHandler(authController.logoutAll.bind(authController)));
router.post('/change-password', authMiddleware, asyncHandler(authController.changePassword.bind(authController)));
router.post('/admin', authMiddleware, asyncHandler(authController.createAdmin.bind(authController)));

export default router;
