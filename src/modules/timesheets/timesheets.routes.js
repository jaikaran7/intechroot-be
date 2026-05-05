import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { createTimesheetSchema, rejectTimesheetSchema } from './timesheets.schema.js';
import * as TimesheetsController from './timesheets.controller.js';

// This router is used both standalone (/api/v1/timesheets) and nested (/api/v1/employees/:employeeId/timesheets)
const router = Router({ mergeParams: true });

// GET / — smart handler: employee-nested when :employeeId param present, admin-only otherwise
router.get('/', authenticate, requireRole('admin', 'super_admin', 'employee'), (req, res, next) => {
  if (req.params.employeeId) {
    return TimesheetsController.getEmployeeTimesheets(req, res, next);
  }
  // standalone admin list — employees must not reach this
  if (req.user.role === 'employee') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  return TimesheetsController.getAllTimesheets(req, res, next);
});

router.patch('/:id/submit-for-approval', authenticate, requireRole('employee'), TimesheetsController.submitTimesheetForApproval);

router.patch('/:id/approve', authenticate, requireRole('admin', 'super_admin'), TimesheetsController.approveTimesheet);
router.patch('/:id/reject', authenticate, requireRole('admin', 'super_admin'), validateBody(rejectTimesheetSchema), TimesheetsController.rejectTimesheet);

// Employee POST — save draft (create/update); send for approval is PATCH .../:id/submit-for-approval
router.post('/', authenticate, requireRole('employee'), validateBody(createTimesheetSchema), TimesheetsController.saveTimesheetDraft);

export default router;
