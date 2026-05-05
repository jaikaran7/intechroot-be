import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { rejectTimesheetSchema } from '../timesheets/timesheets.schema.js';
import * as AdminPanelController from './admin-panel.controller.js';

const router = Router();

router.get('/admins', authenticate, requireRole('super_admin'), AdminPanelController.listAdmins);
router.post('/admins', authenticate, requireRole('super_admin'), AdminPanelController.createAdmin);
router.get('/admins/:id', authenticate, requireRole('super_admin'), AdminPanelController.getAdmin);
router.put('/admins/:id', authenticate, requireRole('super_admin'), AdminPanelController.updateAdmin);
router.delete('/admins/:id', authenticate, requireRole('super_admin'), AdminPanelController.deleteAdmin);
router.get('/admins/:id/assignments', authenticate, requireRole('super_admin'), AdminPanelController.getAdminAssignments);
router.put('/admins/:id/assignments', authenticate, requireRole('super_admin'), AdminPanelController.setAdminAssignments);

router.get('/employees', authenticate, requireRole('ADMIN', 'super_admin'), AdminPanelController.listEmployees);
router.get('/dashboard', authenticate, requireRole('ADMIN'), AdminPanelController.getDashboard);
router.get('/timesheets', authenticate, requireRole('ADMIN'), AdminPanelController.getTimesheets);
router.patch('/timesheets/:id/approve', authenticate, requireRole('ADMIN'), AdminPanelController.approveTimesheet);
router.patch(
  '/timesheets/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  validateBody(rejectTimesheetSchema),
  AdminPanelController.rejectTimesheet,
);

export default router;
