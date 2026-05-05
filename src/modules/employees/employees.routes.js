import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import {
  updateEmployeeSchema,
  employeeStatusSchema,
  extraDocumentRequestSchema,
  employeeDashboardMessageSchema,
} from './employees.schema.js';
import * as EmployeesController from './employees.controller.js';
import timesheetRoutes from '../timesheets/timesheets.routes.js';

const router = Router();

router.get('/', authenticate, requireRole('admin', 'super_admin'), EmployeesController.getEmployees);
router.get('/:id', authenticate, requireRole('admin', 'super_admin', 'employee'), EmployeesController.getEmployeeById);
router.post(
  '/:id/extra-document-requests',
  authenticate,
  requireRole('admin', 'super_admin', 'employee'),
  validateBody(extraDocumentRequestSchema),
  EmployeesController.addExtraDocumentRequest,
);
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'super_admin', 'employee'),
  validateBody(updateEmployeeSchema),
  EmployeesController.updateEmployee,
);
router.patch('/:id/status', authenticate, requireRole('admin', 'super_admin'), validateBody(employeeStatusSchema), EmployeesController.updateEmployeeStatus);
router.post(
  '/:id/dashboard-message',
  authenticate,
  requireRole('admin', 'super_admin'),
  validateBody(employeeDashboardMessageSchema),
  EmployeesController.postDashboardMessage,
);

// Nest timesheets under employees
router.use('/:employeeId/timesheets', timesheetRoutes);

export default router;
