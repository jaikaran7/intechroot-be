import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import * as AdminController from './admin.controller.js';

const router = Router();

router.get('/dashboard/stats', authenticate, requireRole('admin', 'super_admin'), AdminController.getDashboardStats);
router.get('/reports/pipeline', authenticate, requireRole('admin', 'super_admin'), AdminController.getPipelineReport);

export default router;
