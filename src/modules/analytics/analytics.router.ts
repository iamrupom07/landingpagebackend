import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/async.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/summary', asyncHandler(analyticsController.getSummary.bind(analyticsController)));

export default router;
