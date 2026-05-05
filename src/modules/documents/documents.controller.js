import * as DocumentsService from './documents.service.js';
import { AppError, ForbiddenError } from '../../utils/errors.js';

/** These uploads do not carry an ID expiry date in the onboarding UI (photos, incorporation, banking). */
const EXPIRY_OPTIONAL_TEMPLATE_KEYS = new Set([
  'profile_photo',
  'incorp',
  'deposit',
  'resume',
]);

function templateRequiresExpiryDate(templateKey) {
  const k = String(templateKey || '').trim();
  if (!k) return true;
  return !EXPIRY_OPTIONAL_TEMPLATE_KEYS.has(k);
}

function assertFutureExpiryIfRequired(templateKey, expiryDate) {
  if (!templateRequiresExpiryDate(templateKey)) return;
  if (!expiryDate || String(expiryDate).trim() === '') {
    throw new AppError('Expiry date is required for this document. Select a future expiry date before uploading.', 400);
  }
  const selected = new Date(`${String(expiryDate).slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(selected.getTime()) || selected < today) {
    throw new AppError('Expiry date must be today or in the future', 400);
  }
}

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
    assertFutureExpiryIfRequired(templateKey, expiryDate);

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
    await DocumentsService.deleteDocument(req.params.id, req.user);
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
    assertFutureExpiryIfRequired(templateKey, expiryDate);
    const doc = await DocumentsService.upsertDocument(
      req.file.buffer,
      { originalname: req.file.originalname, mimetype: req.file.mimetype },
      { applicationId, employeeId, templateKey, name, expiryDate }
    );
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}
