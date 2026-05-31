import { Router } from 'express';
import { leadsController } from './leads.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/async.middleware';

const router = Router();

// Public — landing page form submission
router.post('/', asyncHandler(leadsController.create.bind(leadsController)));

// Admin protected
router.use(authMiddleware);
router.post('/manual',       asyncHandler(leadsController.createManual.bind(leadsController)));
router.get('/export',        asyncHandler(leadsController.exportCSV.bind(leadsController)));
router.get('/',              asyncHandler(leadsController.findAll.bind(leadsController)));
router.get('/:id',           asyncHandler(leadsController.findById.bind(leadsController)));
router.patch('/:id/status',  asyncHandler(leadsController.updateStatus.bind(leadsController)));
router.post('/:id/email',    asyncHandler(leadsController.sendEmail.bind(leadsController)));
router.delete('/:id',        asyncHandler(leadsController.delete.bind(leadsController)));

export default router;
