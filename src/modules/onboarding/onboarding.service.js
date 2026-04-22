import prisma from '../../config/db.js';
import { NotFoundError, AppError, ForbiddenError } from '../../utils/errors.js';
import { getSignedUrl } from '../../config/supabase.js';

async function signIfStoragePath(value) {
  if (!value || typeof value !== 'string') return value || null;
  if (/^https?:\/\//i.test(value)) return value;
  try {
    return (await getSignedUrl(value, 3600)) || value;
  } catch {
    return value;
  }
}

// Canonical list of mandatory onboarding document keys (mirrors FE REQUIRED_DOCUMENT_ROWS).
const MANDATORY_DOCUMENT_KEYS = ['passport', 'workAuth', 'govId', 'sin'];

async function getOnboarding(applicationId) {
  const onboarding = await prisma.onboardingState.findUnique({
    where: { applicationId },
    include: {
      application: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          nationality: true,
          profilePhotoUrl: true,
          profilePhotoName: true,
          lifecycleStage: true,
          status: true,
        },
      },
    },
  });
  if (!onboarding) throw new NotFoundError('Onboarding record not found');
  return onboarding;
}

export async function getOnboardingState(applicationId, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  // Attach the list of required document keys + admin-requested documents so clients can render
  // consistent progress checks without re-querying.
  const [requiredKeys, adminRequests] = await Promise.all([
    getRequiredTemplateKeys(applicationId),
    prisma.adminDocumentRequest.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } }),
  ]);
  const signedPhotoUrl = await signIfStoragePath(onboarding.application?.profilePhotoUrl || null);
  return {
    ...onboarding,
    application: onboarding.application
      ? { ...onboarding.application, profilePhotoUrl: signedPhotoUrl }
      : onboarding.application,
    requiredDocumentKeys: requiredKeys,
    mandatoryDocumentKeys: MANDATORY_DOCUMENT_KEYS,
    adminRequestedDocuments: adminRequests,
  };
}

function parseDateOnlyUtc(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const iso = value.slice(0, 10);
    const m = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    if (!m) return null;
    const d = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

export async function submitProfileStep(applicationId, data, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.enabled) throw new AppError('Onboarding has not been enabled for this applicant', 400);
  if (onboarding.finalSubmitted) {
    throw new AppError('Profile can no longer be edited — the application has been submitted for admin approval', 400);
  }

  const dob = parseDateOnlyUtc(data.dateOfBirth);
  if (!dob) throw new AppError('Date of birth is invalid', 400);

  const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

  const updateData = {
    name: fullName,
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    dateOfBirth: dob,
    nationality: data.nationality.trim(),
  };
  // Only overwrite the stored photo path when the caller sends a raw storage path,
  // not a signed URL (which is what we emit on reads).
  const incomingPhoto = data.profilePhotoUrl?.trim();
  if (incomingPhoto && !/^https?:\/\//i.test(incomingPhoto)) {
    updateData.profilePhotoUrl = incomingPhoto;
    updateData.profilePhotoName = data.profilePhotoName?.trim() || null;
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: updateData,
  });

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { profileCompleted: true, step: Math.max(onboarding.step, 2) },
  });
}

/** Allowed from applicant (review step) + admin when not yet final-submitted. */
export async function patchApplicantProfile(applicationId, data, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.enabled) throw new AppError('Onboarding has not been enabled for this applicant', 400);
  if (onboarding.finalSubmitted && requestingUser?.role === 'applicant') {
    throw new AppError('Profile can no longer be edited — the application has been submitted for admin approval', 400);
  }

  const update = {};
  if (data.firstName != null || data.lastName != null) {
    const first = (data.firstName ?? '').trim();
    const last = (data.lastName ?? '').trim();
    if (first || last) update.name = `${first} ${last}`.trim();
  }
  if (data.email != null) update.email = data.email.trim().toLowerCase();
  if (data.phone != null) update.phone = data.phone.trim();
  if (data.dateOfBirth != null) {
    const dob = parseDateOnlyUtc(data.dateOfBirth);
    if (!dob) throw new AppError('Date of birth is invalid', 400);
    update.dateOfBirth = dob;
  }
  if (data.nationality != null) update.nationality = data.nationality.trim();
  if (data.profilePhotoUrl != null) {
    const val = data.profilePhotoUrl.trim();
    // Ignore signed URLs; only persist raw storage paths.
    if (val && !/^https?:\/\//i.test(val)) update.profilePhotoUrl = val;
  }
  if (data.profilePhotoName != null) update.profilePhotoName = data.profilePhotoName.trim() || null;

  if (Object.keys(update).length > 0) {
    await prisma.application.update({ where: { id: applicationId }, data: update });
  }
  return getOnboarding(applicationId);
}

/** Returns the list of required template keys (mandatory base + admin-requested). */
async function getRequiredTemplateKeys(applicationId) {
  const adminRequests = await prisma.adminDocumentRequest.findMany({
    where: { applicationId },
    select: { id: true },
  });
  return [...MANDATORY_DOCUMENT_KEYS, ...adminRequests.map((r) => `adminreq_${r.id}`)];
}

export async function submitDocumentsStep(applicationId, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.profileCompleted) throw new AppError('Profile step must be completed first', 400);

  const requiredKeys = await getRequiredTemplateKeys(applicationId);
  const docs = await prisma.document.findMany({
    where: {
      applicationId,
      templateKey: { in: requiredKeys },
      status: { in: ['uploaded', 'expiring_soon'] },
    },
    select: { templateKey: true },
  });
  const have = new Set(docs.map((d) => d.templateKey));
  const missing = requiredKeys.filter((k) => !have.has(k));
  if (missing.length > 0) {
    throw new AppError(
      `All mandatory documents must be uploaded before continuing (${missing.length} missing).`,
      400,
    );
  }

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { documentsCompleted: true, step: Math.max(onboarding.step, 3) },
  });
}

export async function acknowledgeBgv(applicationId, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.documentsCompleted) throw new AppError('Documents step must be completed first', 400);

  // Verification step requires the ID document (govId or passport) to be on file.
  const idDoc = await prisma.document.findFirst({
    where: {
      applicationId,
      templateKey: { in: ['govId', 'passport'] },
      status: { in: ['uploaded', 'expiring_soon'] },
    },
    select: { id: true },
  });
  if (!idDoc) {
    throw new AppError('An identity document (Passport or Government ID) must be uploaded before verification', 400);
  }

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { bgvApplicantAcknowledged: true, step: Math.max(onboarding.step, 4) },
  });
}

export async function finalSubmit(applicationId, requestingUser) {
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.profileCompleted) throw new AppError('Profile step must be completed first', 400);
  if (!onboarding.documentsCompleted) throw new AppError('Documents step must be completed first', 400);
  if (!onboarding.bgvApplicantAcknowledged) throw new AppError('Verification must be acknowledged first', 400);

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: 'Pending Admin Approval' },
  });

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { finalSubmitted: true, step: 5 },
  });
}

// Admin actions
export async function adminEnableOnboarding(applicationId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { onboarding: true },
  });
  if (!application) throw new NotFoundError('Application not found');

  await prisma.application.update({
    where: { id: applicationId },
    data: { lifecycleStage: 'onboarding' },
  });

  return prisma.onboardingState.upsert({
    where: { applicationId },
    create: { applicationId, enabled: true, step: 1 },
    update: { enabled: true },
  });
}

export async function adminRequestDocument(applicationId, name) {
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.enabled) {
    throw new AppError('Onboarding must be enabled before requesting additional documents', 400);
  }
  // If the applicant had previously completed the documents step, reopen it so the new request
  // blocks progress until the applicant uploads the new document.
  if (onboarding.documentsCompleted) {
    await prisma.onboardingState.update({
      where: { applicationId },
      data: { documentsCompleted: false, bgvApplicantAcknowledged: false, finalSubmitted: false, step: 2 },
    });
  }
  return prisma.adminDocumentRequest.create({
    data: { applicationId, name },
  });
}

export async function adminDeleteDocumentRequest(applicationId, requestId) {
  const existing = await prisma.adminDocumentRequest.findUnique({ where: { id: requestId } });
  if (!existing || existing.applicationId !== applicationId) {
    throw new NotFoundError('Document request not found');
  }
  // Clean up any uploaded doc that mapped to this admin request.
  await prisma.document.deleteMany({
    where: { applicationId, templateKey: `adminreq_${requestId}` },
  });
  await prisma.adminDocumentRequest.delete({ where: { id: requestId } });
  return { deleted: true };
}

/** Marks admin profile review complete so the admin UI advances to document approval. */
export async function adminApproveProfile(applicationId) {
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.enabled) throw new AppError('Onboarding is not enabled for this application', 400);
  if (!onboarding.profileCompleted) {
    throw new AppError('Applicant must complete their profile step before you can approve', 400);
  }

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { adminProfileApproved: true },
  });
}

export async function adminApproveDocuments(applicationId) {
  const onboarding = await getOnboarding(applicationId);
  if (!onboarding.documentsCompleted) throw new AppError('Applicant has not completed the documents step yet', 400);

  return prisma.onboardingState.update({
    where: { applicationId },
    data: { bgvCompleted: true },
  });
}

export async function adminSetBgv(applicationId, { bgvLink, bgvNote }) {
  await getOnboarding(applicationId);
  return prisma.onboardingState.update({
    where: { applicationId },
    data: {
      ...(bgvLink !== undefined && { bgvLink: bgvLink || null }),
      ...(bgvNote !== undefined && { bgvNote: bgvNote || null }),
      bgvCompleted: true,
    },
  });
}
