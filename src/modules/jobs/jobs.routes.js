import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { createJobSchema, updateJobSchema, jobStatusSchema, reorderJobsSchema } from './jobs.schema.js';
import * as JobsController from './jobs.controller.js';

const router = Router();

router.get('/', JobsController.getJobs);
router.patch('/reorder', authenticate, requireRole('admin', 'super_admin'), validateBody(reorderJobsSchema), JobsController.reorderJobs);
router.get('/:id', JobsController.getJobById);
router.post('/', authenticate, requireRole('admin', 'super_admin'), validateBody(createJobSchema), JobsController.createJob);
router.put('/:id', authenticate, requireRole('admin', 'super_admin'), validateBody(updateJobSchema), JobsController.updateJob);
router.patch('/:id/status', authenticate, requireRole('admin', 'super_admin'), validateBody(jobStatusSchema), JobsController.updateJobStatus);
router.delete('/:id', authenticate, requireRole('super_admin'), JobsController.deleteJob);

export default router;
