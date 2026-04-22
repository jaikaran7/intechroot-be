import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { updateEmployeeSchema, employeeStatusSchema } from './employees.schema.js';
import * as EmployeesController from './employees.controller.js';
import timesheetRoutes from '../timesheets/timesheets.routes.js';

const router = Router();

router.get('/', authenticate, requireRole('admin', 'super_admin'), EmployeesController.getEmployees);
router.get('/:id', authenticate, requireRole('admin', 'super_admin', 'employee'), EmployeesController.getEmployeeById);
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), validateBody(updateEmployeeSchema), EmployeesController.updateEmployee);
router.patch('/:id/status', authenticate, requireRole('admin', 'super_admin'), validateBody(employeeStatusSchema), EmployeesController.updateEmployeeStatus);

// Nest timesheets under employees
router.use('/:employeeId/timesheets', timesheetRoutes);

export default router;
