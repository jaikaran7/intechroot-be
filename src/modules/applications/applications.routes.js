import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { optionalResumeUpload } from '../../middleware/upload.js';
import {
  advanceStageSchema,
  createInterviewSchema,
  updateInterviewSchema,
  createMessageSchema,
} from './applications.schema.js';
import * as AppController from './applications.controller.js';

const router = Router();

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many applications. Try again later.' } },
});

// Public (JSON or multipart + optional resume file; body validated in controller)
router.post('/', applyLimiter, optionalResumeUpload, AppController.createApplication);
router.get('/by-email/:email', AppController.getApplicationByEmail);

// Admin
router.get('/', authenticate, requireRole('admin', 'super_admin'), AppController.getApplications);
router.get('/stats', authenticate, requireRole('admin', 'super_admin'), AppController.getApplicationStats);
router.get('/:id', authenticate, AppController.getApplicationById);
router.patch('/:id/stage', authenticate, requireRole('admin', 'super_admin'), validateBody(advanceStageSchema), AppController.advanceStage);
router.patch('/:id/hire', authenticate, requireRole('admin', 'super_admin'), AppController.hireApplicant);
router.patch(
  '/:id/portal-approve',
  authenticate,
  requireRole('admin', 'super_admin'),
  AppController.approvePortalAccess
);
router.patch(
  '/:id/portal-reject',
  authenticate,
  requireRole('admin', 'super_admin'),
  AppController.rejectApplication
);

// Interviews
router.post('/:id/interviews', authenticate, requireRole('admin', 'super_admin'), validateBody(createInterviewSchema), AppController.createInterview);
router.patch('/:id/interviews/:iid', authenticate, requireRole('admin', 'super_admin'), validateBody(updateInterviewSchema), AppController.updateInterview);
router.delete('/:id/interviews/:iid', authenticate, requireRole('admin', 'super_admin', 'applicant'), AppController.deleteInterview);

// Messages
router.post('/:id/messages', authenticate, requireRole('admin', 'super_admin'), validateBody(createMessageSchema), AppController.createMessage);

export default router;
