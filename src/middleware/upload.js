import multer from 'multer';
import { AppError } from '../utils/errors.js';

/** Public job application resumes only — must stay small (frontend matches). */
const MAX_RESUME_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/** Authenticated document uploads (`/documents/*`) may be larger. */
const MAX_DOCUMENT_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/** Applicants use the same endpoints as employees; tighter size cap applies when role === applicant */
const MAX_APPLICANT_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB (match job application / onboarding UX)

function scopeByRole(req) {
  return req.user?.role === 'applicant' ? MAX_APPLICANT_UPLOAD_BYTES : MAX_DOCUMENT_FILE_SIZE;
}

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new AppError(
        'File type not allowed. Use PDF, DOCX, or an image (JPG, PNG, WebP, HEIC).',
        400,
        'INVALID_FILE_TYPE'
      )
    );
  }
  cb(null, true);
}

/** Multer used where role is unknown (prefer `documentUploadForRequest` after auth). */
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_DOCUMENT_FILE_SIZE },
});

/**
 * Runs after `authenticate`. Applicants: 2MB + clear message; employees/admins: 15MB.
 */
export function documentUploadForRequest(req, res, next) {
  const max = scopeByRole(req);
  const instance = multer({
    storage,
    fileFilter,
    limits: { fileSize: max },
  });
  return instance.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      const msg =
        req.user?.role === 'applicant'
          ? 'File exceeds the 2MB limit. Please upload a smaller file (under 2MB).'
          : 'File exceeds the 15MB limit. Please upload a smaller file.';
      return next(new AppError(msg, 400, 'FILE_TOO_LARGE'));
    }
    if (err) return next(err);
    next();
  });
}

const resumeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_RESUME_FILE_SIZE },
});

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File exceeds the 15MB limit.', 400, 'FILE_TOO_LARGE'));
    }
    return next(new AppError(`Upload error: ${err.message}`, 400));
  }
  next(err);
}

/** Run multer only for multipart requests so JSON `POST /applications` still works. */
export function optionalResumeUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return resumeUpload.single('resume')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size exceeds the 2MB limit.', 400, 'FILE_TOO_LARGE'));
      }
      if (err) return next(err);
      next();
    });
  }
  next();
}
