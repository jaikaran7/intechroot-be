import { Router } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { createJobSchema, updateJobSchema, jobStatusSchema, reorderJobsSchema } from './jobs.schema.js';
import * as JobsController from './jobs.controller.js';

const router = Router();

const JOB_WRITE_ROLES = ['admin', 'super_admin', 'hr_admin', 'ADMIN'];

router.get('/', optionalAuth, JobsController.getJobs);
router.patch('/reorder', authenticate, requireRole('admin', 'super_admin'), validateBody(reorderJobsSchema), JobsController.reorderJobs);
router.get('/:id', optionalAuth, JobsController.getJobById);
router.post('/', authenticate, requireRole(...JOB_WRITE_ROLES), validateBody(createJobSchema), JobsController.createJob);
router.put('/:id', authenticate, requireRole(...JOB_WRITE_ROLES), validateBody(updateJobSchema), JobsController.updateJob);
router.patch('/:id/status', authenticate, requireRole(...JOB_WRITE_ROLES), validateBody(jobStatusSchema), JobsController.updateJobStatus);
router.delete('/:id', authenticate, requireRole('super_admin'), JobsController.deleteJob);

export default router;
