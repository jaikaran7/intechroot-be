import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { documentUploadForRequest } from '../../middleware/upload.js';
import * as DocumentsController from './documents.controller.js';

const router = Router();

router.get('/', authenticate, DocumentsController.getDocumentsByOwner);
router.post('/upload', authenticate, documentUploadForRequest, DocumentsController.uploadDocument);
router.post('/upsert', authenticate, documentUploadForRequest, DocumentsController.upsertDocument);
router.get('/:id/download', authenticate, DocumentsController.downloadDocument);
router.patch('/:id/verify', authenticate, requireRole('admin', 'super_admin'), DocumentsController.verifyDocument);
router.delete('/:id', authenticate, DocumentsController.deleteDocument);

export default router;
