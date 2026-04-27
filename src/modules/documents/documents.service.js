import prisma from '../../config/db.js';
import { uploadToStorage, getSignedUrl, deleteFromStorage } from '../../config/supabase.js';
import { NotFoundError, AppError, ForbiddenError } from '../../utils/errors.js';

function buildStoragePath(doc, file) {
  const prefix = doc.applicationId || doc.employeeId || 'general';
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${doc.templateKey}/${timestamp}_${safeName}`;
}

export async function uploadDocument(fileBuffer, fileInfo, metadata) {
  const { applicationId, employeeId, templateKey, name, expiryDate } = metadata;

  const storagePath = buildStoragePath({ applicationId, employeeId, templateKey }, fileInfo);
  await uploadToStorage(fileBuffer, storagePath, fileInfo.mimetype);

  // Check if a document with this templateKey already exists
  const existing = await prisma.document.findFirst({
    where: { templateKey, ...(applicationId ? { applicationId } : { employeeId }) },
  });

  const expiryDateParsed = expiryDate ? new Date(expiryDate) : null;
  const now = new Date();
  const isExpired = expiryDateParsed && expiryDateParsed < now;
  const isExpiringSoon = expiryDateParsed && !isExpired &&
    (expiryDateParsed - now) < 90 * 24 * 60 * 60 * 1000;

  const status = isExpired ? 'expired' : isExpiringSoon ? 'expiring_soon' : 'uploaded';

  if (existing) {
    // Clean up old file
    if (existing.storagePath) {
      await deleteFromStorage(existing.storagePath).catch(() => {});
    }
    return prisma.document.update({
      where: { id: existing.id },
      data: {
        fileName: fileInfo.originalname,
        storagePath,
        fileUrl: storagePath,
        expiryDate: expiryDateParsed,
        status,
        verification: 'unapproved',
        uploadedAt: new Date(),
      },
    });
  }

  return prisma.document.create({
    data: {
      applicationId: applicationId || null,
      employeeId: employeeId || null,
      templateKey,
      name,
      fileName: fileInfo.originalname,
      storagePath,
      fileUrl: storagePath,
      expiryDate: expiryDateParsed,
      status,
      verification: 'unapproved',
      uploadedAt: new Date(),
    },
  });
}

export async function getDownloadUrl(id, requestingUser = null) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError('Document not found');
  if (!doc.storagePath) throw new AppError('Document file not available', 404);

  if (requestingUser && !['admin', 'super_admin'].includes(requestingUser.role)) {
    if (requestingUser.role === 'applicant' && doc.applicationId && requestingUser.applicationId !== doc.applicationId) {
      throw new ForbiddenError();
    }
    if (requestingUser.role === 'employee' && doc.employeeId && requestingUser.employeeId !== doc.employeeId) {
      throw new ForbiddenError();
    }
  }

  const signedUrl = await getSignedUrl(doc.storagePath, 3600);
  return { signedUrl, fileName: doc.fileName };
}

const DOCUMENT_VERIFICATION_VALUES = ['unapproved', 'waiting', 'verified', 'rejected'];

export async function verifyDocument(id, verification) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError('Document not found');
  if (!DOCUMENT_VERIFICATION_VALUES.includes(verification)) {
    throw new AppError('Invalid verification value', 400);
  }

  return prisma.document.update({ where: { id }, data: { verification } });
}

export async function deleteDocument(id) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError('Document not found');

  if (doc.storagePath) {
    await deleteFromStorage(doc.storagePath).catch(() => {});
  }
  await prisma.document.delete({ where: { id } });
}

// Returns all documents for a given owner (applicant or employee)
export async function getDocumentsByOwner(ownerId, ownerType) {
  const where = ownerType === 'employee'
    ? { employeeId: ownerId }
    : { applicationId: ownerId };

  return prisma.document.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
  });
}

// Upsert: soft-delete existing active doc of same templateKey, create new active version
export async function upsertDocument(fileBuffer, fileInfo, metadata) {
  const { applicationId, employeeId, templateKey, name, expiryDate } = metadata;
  const ownerWhere = applicationId ? { applicationId } : { employeeId };

  // Soft-delete existing active document of same type
  const existing = await prisma.document.findFirst({
    where: { templateKey, ...ownerWhere },
  });

  if (existing && existing.storagePath) {
    await deleteFromStorage(existing.storagePath).catch(() => {});
  }
  if (existing) {
    await prisma.document.delete({ where: { id: existing.id } });
  }

  // Upload new version and create fresh record with reset verification
  const storagePath = buildStoragePath({ applicationId, employeeId, templateKey }, fileInfo);
  await uploadToStorage(fileBuffer, storagePath, fileInfo.mimetype);

  const expiryDateParsed = expiryDate ? new Date(expiryDate) : null;
  const now = new Date();
  const isExpired = expiryDateParsed && expiryDateParsed < now;
  const isExpiringSoon = expiryDateParsed && !isExpired &&
    (expiryDateParsed - now) < 90 * 24 * 60 * 60 * 1000;
  const status = isExpired ? 'expired' : isExpiringSoon ? 'expiring_soon' : 'uploaded';

  return prisma.document.create({
    data: {
      applicationId: applicationId || null,
      employeeId: employeeId || null,
      templateKey,
      name,
      fileName: fileInfo.originalname,
      storagePath,
      fileUrl: storagePath,
      expiryDate: expiryDateParsed,
      status,
      verification: 'unapproved', // reset — admin must re-verify
      uploadedAt: new Date(),
    },
  });
}
