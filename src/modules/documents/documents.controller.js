import * as DocumentsService from './documents.service.js';
import { AppError, ForbiddenError } from '../../utils/errors.js';

export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) throw new AppError('No file provided', 400);

    const { applicationId, employeeId, templateKey, name, expiryDate } = req.body;
    if (!templateKey || !name) throw new AppError('templateKey and name are required', 400);
    if (!applicationId && !employeeId) throw new AppError('applicationId or employeeId is required', 400);

    if (req.user?.role === 'applicant' && applicationId && req.user.applicationId !== applicationId) {
      return next(new ForbiddenError());
    }
    if (req.user?.role === 'employee' && employeeId && req.user.employeeId !== employeeId) {
      return next(new ForbiddenError());
    }
    if (req.user?.role === 'employee' && employeeId) {
      if (!expiryDate || String(expiryDate).trim() === '') {
        throw new AppError('Expiry date is required for employee document uploads', 400);
      }
    }

    const doc = await DocumentsService.uploadDocument(
      req.file.buffer,
      { originalname: req.file.originalname, mimetype: req.file.mimetype },
      { applicationId, employeeId, templateKey, name, expiryDate }
    );

    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}

export async function downloadDocument(req, res, next) {
  try {
    const { signedUrl, fileName } = await DocumentsService.getDownloadUrl(req.params.id, req.user);
    res.json({ success: true, data: { signedUrl, fileName } });
  } catch (err) { next(err); }
}

export async function verifyDocument(req, res, next) {
  try {
    const { verification } = req.body;
    const doc = await DocumentsService.verifyDocument(req.params.id, verification);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
}

export async function deleteDocument(req, res, next) {
  try {
    await DocumentsService.deleteDocument(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
}

export async function getDocumentsByOwner(req, res, next) {
  try {
    const { ownerId, ownerType } = req.query;
    if (!ownerId || !ownerType) {
      return res.status(400).json({ success: false, error: { message: 'ownerId and ownerType are required' } });
    }
    if (req.user?.role === 'applicant' && ownerType === 'application' && req.user.applicationId !== ownerId) {
      return next(new ForbiddenError());
    }
    if (req.user?.role === 'employee' && ownerType === 'employee' && req.user.employeeId !== ownerId) {
      return next(new ForbiddenError());
    }
    const docs = await DocumentsService.getDocumentsByOwner(ownerId, ownerType);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
}

export async function upsertDocument(req, res, next) {
  try {
    if (!req.file) throw new (await import('../../utils/errors.js')).AppError('No file provided', 400);
    const { applicationId, employeeId, templateKey, name, expiryDate } = req.body;
    if (!templateKey || !name) {
      return res.status(400).json({ success: false, error: { message: 'templateKey and name are required' } });
    }
    if (!applicationId && !employeeId) {
      return res.status(400).json({ success: false, error: { message: 'applicationId or employeeId is required' } });
    }
    if (req.user?.role === 'applicant' && applicationId && req.user.applicationId !== applicationId) {
      return next(new ForbiddenError());
    }
    if (req.user?.role === 'employee' && employeeId && req.user.employeeId !== employeeId) {
      return next(new ForbiddenError());
    }
    if (req.user?.role === 'employee' && employeeId) {
      if (!expiryDate || String(expiryDate).trim() === '') {
        throw new AppError('Expiry date is required for employee document uploads', 400);
      }
    }
    const doc = await DocumentsService.upsertDocument(
      req.file.buffer,
      { originalname: req.file.originalname, mimetype: req.file.mimetype },
      { applicationId, employeeId, templateKey, name, expiryDate }
    );
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}
