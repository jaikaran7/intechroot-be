import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import {
  profileStepSchema,
  profileStepPartialSchema,
  bgvAcknowledgeSchema,
  adminDocRequestSchema,
  adminBgvSchema,
} from './onboarding.schema.js';
import * as OnboardingController from './onboarding.controller.js';

const router = Router({ mergeParams: true });

// Applicant steps
router.get('/:applicationId', authenticate, OnboardingController.getOnboardingState);
router.patch('/:applicationId/profile', authenticate, requireRole('applicant'), validateBody(profileStepSchema), OnboardingController.submitProfile);
// Partial patch (used by the Review step to edit a single field before submit).
router.patch('/:applicationId/profile/partial', authenticate, requireRole('applicant', 'admin', 'super_admin'), validateBody(profileStepPartialSchema), OnboardingController.patchProfile);
router.patch('/:applicationId/documents', authenticate, requireRole('applicant'), OnboardingController.submitDocuments);
router.patch('/:applicationId/bgv-acknowledge', authenticate, requireRole('applicant'), validateBody(bgvAcknowledgeSchema), OnboardingController.acknowledgeBgv);
router.patch('/:applicationId/final-submit', authenticate, requireRole('applicant'), OnboardingController.finalSubmit);

// Admin actions
router.post('/:applicationId/admin/enable', authenticate, requireRole('admin', 'super_admin'), OnboardingController.adminEnableOnboarding);
router.patch('/:applicationId/admin/profile/approve', authenticate, requireRole('admin', 'super_admin'), OnboardingController.adminApproveProfile);
router.post('/:applicationId/admin/documents/request', authenticate, requireRole('admin', 'super_admin'), validateBody(adminDocRequestSchema), OnboardingController.adminRequestDocument);
router.delete('/:applicationId/admin/documents/request/:requestId', authenticate, requireRole('admin', 'super_admin'), OnboardingController.adminDeleteDocumentRequest);
router.patch('/:applicationId/admin/documents/approve', authenticate, requireRole('admin', 'super_admin'), OnboardingController.adminApproveDocuments);
router.patch('/:applicationId/admin/bgv/approve', authenticate, requireRole('admin', 'super_admin'), validateBody(adminBgvSchema), OnboardingController.adminSetBgv);

export default router;
