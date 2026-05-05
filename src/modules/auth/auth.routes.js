import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  applicantLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import * as AuthController from './auth.controller.js';

const router = Router();

// Admin / Staff
router.post('/register', authenticate, validateBody(registerSchema), AuthController.register);
router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);

// Applicant (email + password issued after admin approves the application)
router.post('/applicant/login', validateBody(applicantLoginSchema), AuthController.applicantLogin);

// Password reset (employee + applicant)
router.post('/forgot-password', validateBody(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), AuthController.resetPassword);

// Employee
router.post('/employee/login', validateBody(loginSchema), AuthController.employeeLogin);

export default router;
