import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import * as PayrollController from './payroll.controller.js';

const router = Router();

router.get('/payslips', authenticate, requireRole('admin', 'super_admin'), PayrollController.getAllPayslips);
router.post('/payslips', authenticate, requireRole('admin', 'super_admin'), PayrollController.createPayslip);
router.get('/payslips/:employeeId', authenticate, requireRole('admin', 'super_admin', 'employee'), PayrollController.getEmployeePayslips);

export default router;
