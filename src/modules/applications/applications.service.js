import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { NotFoundError, ConflictError, AppError, ForbiddenError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';
import { sendEmail, stageAdvancedEmail, applicantPortalApprovedEmail } from '../../utils/email.js';
import { applicantUsesPasswordLogin } from '../../utils/applicantAuthMode.js';
import { uploadToStorage, getSignedUrl } from '../../config/supabase.js';
import { getDefaultEmployeePortalPassword } from '../../utils/employeePortalDefaults.js';

const STAGE_ORDER = [
  'Application Submitted',
  'Profile Screening',
  'Technical Evaluation',
  'Client Interview',
  'Offer & Onboarding',
];

const LIFECYCLE_MAP = {
  0: 'applied',
  1: 'screening',
  2: 'technical',
  3: 'client',
  4: 'offer',
};

function generateReferenceId(numericSuffix) {
  return `ITR-${String(numericSuffix).padStart(5, '0')}`;
}

function toDateOnlyString(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

async function signStoragePath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return null;
  try {
    return await getSignedUrl(storagePath, 3600);
  } catch {
    return null;
  }
}

/** Human-readable pipeline stage for API consumers (lists + detail). */
function resolveDisplayStage(app) {
  if (app.lifecycleStage === 'employee' || app.status === 'Employee') return 'Employee';
  const idx = app.currentStageIndex;
  if (Number.isFinite(idx) && idx >= 0 && idx < STAGE_ORDER.length) return STAGE_ORDER[idx];
  return app.status;
}

function listApplicationRow(app) {
  return {
    ...app,
    stage: resolveDisplayStage(app),
  };
}

async function loadApplicationBundle(id) {
  return prisma.application.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { date: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
      interviews: { orderBy: { date: 'asc' } },
      onboarding: true,
      documents: true,
      adminDocRequests: true,
    },
  });
}

export async function serializeApplication(application) {
  if (!application) return null;

  const docs = application.documents || [];
  const resumeDoc = docs.find((d) => d.templateKey === 'resume');
  const coverDoc = docs.find((d) => d.templateKey === 'cover_letter' || d.templateKey === 'coverLetter');

  let resumeUrl = null;
  if (resumeDoc?.storagePath) resumeUrl = await signStoragePath(resumeDoc.storagePath);
  else if (application.resumeFileUrl) resumeUrl = await signStoragePath(application.resumeFileUrl);

  let coverUrl = null;
  if (coverDoc?.storagePath) coverUrl = await signStoragePath(coverDoc.storagePath);

  let profilePhotoUrl = application.profilePhotoUrl || null;
  if (profilePhotoUrl && !/^https?:\/\//i.test(profilePhotoUrl)) {
    profilePhotoUrl = await signStoragePath(profilePhotoUrl);
  }

  const onboardingDocuments = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      fileUrl: d.storagePath ? (await signStoragePath(d.storagePath)) || d.fileUrl : d.fileUrl,
    })),
  );

  const stages = (application.stages || []).map((s) => ({
    ...s,
    date:
      s.date instanceof Date
        ? s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : s.date,
  }));

  const messages = (application.messages || []).map((m) => ({
    ...m,
    date: m.createdAt,
    text: m.text,
  }));

  const interviews = (application.interviews || []).map((iv) => ({
    ...iv,
    date: iv.date instanceof Date ? iv.date.toISOString().slice(0, 10) : iv.date,
  }));

  const { documents: _docRows, adminDocRequests, ...rest } = application;

  return {
    ...rest,
    profilePhotoUrl,
    stage: resolveDisplayStage(application),
    stages,
    messages,
    interviews,
    documents: {
      resume: resumeUrl,
      coverLetter: coverUrl,
      portfolio: application.portfolio || null,
    },
    onboardingDocuments,
    adminRequestedDocuments: adminDocRequests || [],
  };
}

export async function getApplications(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { role: { contains: query.search, mode: 'insensitive' } },
      { referenceId: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.jobId) where.jobId = query.jobId;
  if (query.role) where.role = { equals: query.role, mode: 'insensitive' };
  if (query.stage) where.lifecycleStage = query.stage;
  if (query.status) where.status = { contains: query.status, mode: 'insensitive' };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: { appliedDate: 'desc' },
      include: { onboarding: true, interviews: { orderBy: { date: 'desc' }, take: 1 } },
    }),
    prisma.application.count({ where }),
  ]);

  const data = applications.map((a) => listApplicationRow(a));
  return paginatedResponse(data, total, page, limit);
}

/** Dashboard aggregates for admin Applications page (KPIs + funnel). Optional `jobId` scopes counts. */
export async function getApplicationStats(query = {}) {
  const baseWhere = {};
  if (query.jobId) baseWhere.jobId = query.jobId;

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 30);
  const start60 = new Date(now);
  start60.setDate(start60.getDate() - 60);

  const [
    total,
    countLast30,
    countPrev30,
    underReview,
    interviewScheduled,
    selected,
    rejected,
    pipelineApplied,
    pipelineScreening,
    pipelineTechnical,
    pipelineClient,
    pipelineOffer,
    pipelineOnboarding,
    pipelineEmployee,
  ] = await Promise.all([
    prisma.application.count({ where: baseWhere }),
    prisma.application.count({ where: { ...baseWhere, createdAt: { gte: start30 } } }),
    prisma.application.count({ where: { ...baseWhere, createdAt: { gte: start60, lt: start30 } } }),
    prisma.application.count({
      where: {
        ...baseWhere,
        lifecycleStage: { in: ['applied', 'screening', 'technical', 'client'] },
      },
    }),
    prisma.application.count({
      where: {
        ...baseWhere,
        interviews: { some: { status: 'scheduled' } },
      },
    }),
    prisma.application.count({
      where: {
        ...baseWhere,
        OR: [
          { lifecycleStage: { in: ['offer', 'onboarding', 'employee'] } },
          { status: 'Employee' },
        ],
      },
    }),
    prisma.application.count({
      where: {
        ...baseWhere,
        status: { contains: 'reject', mode: 'insensitive' },
      },
    }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'applied' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'screening' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'technical' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'client' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'offer' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'onboarding' } }),
    prisma.application.count({ where: { ...baseWhere, lifecycleStage: 'employee' } }),
  ]);

  const trendPercent =
    countPrev30 === 0 ? (countLast30 > 0 ? 100 : 0) : Math.round(((countLast30 - countPrev30) / countPrev30) * 100);
  const underReviewProgress = total > 0 ? underReview / total : 0;
  const rejectedRatePercent = total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0;
  const selectedSharePercent = total > 0 ? Math.round((selected / total) * 1000) / 10 : 0;

  const pipelineSelected = pipelineOffer + pipelineOnboarding + pipelineEmployee;

  return {
    kpis: {
      totalApplications: total,
      newApplicationsTrendPercent: trendPercent,
      underReview,
      underReviewProgress,
      interviewScheduled,
      selected,
      selectedSharePercent,
      rejected,
      rejectedRatePercent,
    },
    pipeline: {
      applied: pipelineApplied,
      screening: pipelineScreening,
      technical: pipelineTechnical,
      hrInterview: pipelineClient,
      selected: pipelineSelected,
    },
  };
}

export async function getApplicationById(id, requestingUser) {
  const application = await loadApplicationBundle(id);

  if (!application) throw new NotFoundError('Application not found');

  // Applicants can only view their own application
  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== id) {
    throw new NotFoundError('Application not found');
  }

  return serializeApplication(application);
}

export async function getApplicationByEmail(email) {
  const row = await prisma.application.findFirst({
    where: { email: { equals: email.toLowerCase().trim(), mode: 'insensitive' } },
    select: { id: true },
  });
  if (!row) throw new NotFoundError('No application found with this email');
  const application = await loadApplicationBundle(row.id);
  return serializeApplication(application);
}

export async function createApplication(data, file = null) {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Duplicate check per job
  if (data.jobId) {
    const existing = await prisma.application.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' }, jobId: data.jobId },
    });
    if (existing) throw new ConflictError('You have already applied for this position');
  }

  // Generate sequential reference ID
  const count = await prisma.application.count();
  const referenceId = generateReferenceId(count + 1);

  const application = await prisma.application.create({
    data: {
      referenceId,
      jobId: data.jobId || null,
      name: data.name,
      email: normalizedEmail,
      phone: data.phone,
      role: data.discipline,
      experience: data.experience,
      location: data.location || '',
      linkedIn: data.linkedIn || null,
      portfolio: data.portfolio || null,
      skills: data.skills || [],
      resumeFileName: file?.originalname || data.resumeFileName || null,
      status: 'In Review',
      lifecycleStage: 'applied',
      currentStageIndex: 0,
      portalApprovedAt: null,
      stages: {
        create: [{ name: 'Application Submitted', status: 'completed' }],
      },
      onboarding: {
        create: {},
      },
    },
    include: { onboarding: true },
  });

  if (file?.buffer) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${application.id}/resume/${Date.now()}_${safeName}`;
    await uploadToStorage(file.buffer, storagePath, file.mimetype);
    await prisma.document.create({
      data: {
        applicationId: application.id,
        templateKey: 'resume',
        name: 'Resume',
        fileName: file.originalname,
        storagePath,
        fileUrl: storagePath,
        status: 'uploaded',
        uploadedAt: new Date(),
      },
    });
    await prisma.application.update({
      where: { id: application.id },
      data: { resumeFileUrl: storagePath, resumeFileName: file.originalname },
    });
  }

  // Increment job applicant count
  if (data.jobId) {
    await prisma.job.update({
      where: { id: data.jobId },
      data: { applicantsCount: { increment: 1 } },
    }).catch(() => {});
  }

  const full = await loadApplicationBundle(application.id);
  return serializeApplication(full);
}

export async function advanceStage(id, actingUser, note) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new NotFoundError('Application not found');

  const nextIndex = application.currentStageIndex + 1;
  if (nextIndex >= STAGE_ORDER.length) {
    throw new AppError('Application is already at the final stage', 400);
  }

  const nextStageName = STAGE_ORDER[nextIndex];
  const nextLifecycle = LIFECYCLE_MAP[nextIndex] || 'offer';

  await prisma.application.update({
    where: { id },
    data: {
      currentStageIndex: nextIndex,
      lifecycleStage: nextLifecycle,
      status: nextStageName,
      stages: {
        create: [{ name: nextStageName, status: 'completed' }],
      },
    },
    include: { stages: true },
  });

  // Send email notification
  const emailContent = stageAdvancedEmail(application.name, nextStageName);
  await sendEmail({ to: application.email, ...emailContent });

  const full = await loadApplicationBundle(id);
  return serializeApplication(full);
}

export async function hireApplicant(id) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: { onboarding: true, documents: true },
  });
  if (!application) throw new NotFoundError('Application not found');
  if (application.lifecycleStage === 'employee') {
    throw new AppError('Applicant has already been hired', 400);
  }
  if (!application.onboarding?.finalSubmitted) {
    throw new AppError('Applicant must complete onboarding before being hired', 400);
  }

  const emailLower = String(application.email || '').trim().toLowerCase();
  if (!emailLower) {
    throw new AppError('Application email is required to create employee login', 400);
  }

  // Atomic transaction: create employee + employee User (portal) + update application + link documents
  const result = await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { applicantApplicationId: id } });

    const passwordHash = await bcrypt.hash(getDefaultEmployeePortalPassword(), 12);

    const employee = await tx.employee.create({
      data: {
        applicationId: id,
        name: application.name,
        email: emailLower,
        phone: application.phone ?? '',
        role: application.role,
        department: 'General',
        client: '',
        status: 'Active',
        // Auto-populate personal data from application
        personal: {
          dateOfBirth: toDateOnlyString(application.dateOfBirth),
          gender: application.gender ?? '',
          address: application.location ?? '',
        },
        // Auto-populate employment data from application
        employment: {
          employmentType: 'Full-Time',
          jobTitle: application.role,
          joiningDate: new Date().toISOString(),
          experience: application.experience ?? '',
          shiftType: 'Standard',
          payFrequency: 'Bi-Weekly',
          contractType: 'Permanent',
          employmentStatus: 'Active Deployment',
          employmentStatusTag: 'active',
        },
      },
    });

    const updated = await tx.application.update({
      where: { id },
      data: {
        lifecycleStage: 'employee',
        status: 'Employee',
        employeeId: employee.id,
        currentStageIndex: STAGE_ORDER.length - 1,
        onboarding: { update: { hireCompleted: true, completed: true } },
      },
    });

    // Link all onboarding documents to the new employee record
    if (application.documents.length > 0) {
      await tx.document.updateMany({
        where: { applicationId: id },
        data: { employeeId: employee.id },
      });
    }

    const existingUser = await tx.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      if (existingUser.role === 'super_admin' || existingUser.role === 'admin') {
        throw new ConflictError('This email is already used by an admin account.');
      }
      if (
        existingUser.role === 'applicant' &&
        existingUser.applicantApplicationId &&
        existingUser.applicantApplicationId !== id
      ) {
        throw new ConflictError('This email is tied to another applicant portal account.');
      }
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          name: application.name,
          role: 'employee',
          applicantApplicationId: null,
          isActive: true,
        },
      });
    } else {
      await tx.user.create({
        data: {
          email: emailLower,
          name: application.name,
          passwordHash,
          role: 'employee',
          applicantApplicationId: null,
        },
      });
    }

    return {
      application: updated,
      employee,
      /** Same email as the application; password from getDefaultEmployeePortalPassword() (default Employee@123). */
      employeeAuth: { email: emailLower, defaultPasswordConfigured: true },
    };
  });

  return result;
}

/** Admin grants applicant portal access: creates/updates applicant user, emails temporary password. */
export async function approvePortalAccess(id) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new NotFoundError('Application not found');
  if (/reject/i.test(application.status || '')) {
    throw new AppError('Cannot approve a rejected application', 400);
  }
  if (application.lifecycleStage === 'employee') {
    throw new AppError('Applicant is already an employee', 400);
  }
  if (application.portalApprovedAt) {
    throw new AppError('Portal access was already granted for this application', 400);
  }

  const usePassword = applicantUsesPasswordLogin();

  if (!usePassword) {
    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { applicantApplicationId: id } });
      await tx.application.update({
        where: { id },
        data: { portalApprovedAt: new Date() },
      });
    });
    return { portalApproved: true, mode: 'passwordless' };
  }

  const plainPassword = crypto.randomBytes(12).toString('base64url').slice(0, 16);
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  const emailLower = application.email.toLowerCase();

  await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: emailLower } });
    if (existingUser && existingUser.role !== 'applicant') {
      throw new ConflictError('This email is already linked to a staff account. Use a different workflow.');
    }

    await tx.application.update({
      where: { id },
      data: { portalApprovedAt: new Date() },
    });

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          applicantApplicationId: id,
          name: application.name,
          isActive: true,
          role: 'applicant',
        },
      });
    } else {
      await tx.user.create({
        data: {
          email: emailLower,
          name: application.name,
          passwordHash,
          role: 'applicant',
          applicantApplicationId: id,
        },
      });
    }
  });

  const base =
    process.env.APPLICANT_PORTAL_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';
  const loginUrl = `${base.replace(/\/$/, '')}/applicant/login`;
  const emailContent = applicantPortalApprovedEmail(
    application.name,
    application.email,
    plainPassword,
    loginUrl
  );
  await sendEmail({ to: application.email, ...emailContent });

  return { portalApproved: true, mode: 'email' };
}

/** Admin rejects the application; removes portal user if any. */
export async function rejectApplication(id) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new NotFoundError('Application not found');
  if (application.lifecycleStage === 'employee') {
    throw new AppError('Cannot reject a hired employee record', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({ where: { applicantApplicationId: id } });
    await tx.application.update({
      where: { id },
      data: {
        status: 'Rejected',
        portalApprovedAt: null,
      },
    });
  });

  return { rejected: true };
}

export async function createInterview(applicationId, data) {
  const exists = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Application not found');
  return prisma.interview.create({
    data: {
      applicationId,
      title: data.title,
      type: data.type || 'Technical',
      date: new Date(data.date),
      time: data.time,
      ...(data.link && { link: data.link }),
      ...(data.notes && { notes: data.notes }),
    },
  });
}

export async function updateInterview(applicationId, interviewId, data) {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, applicationId },
  });
  if (!interview) throw new NotFoundError('Interview not found');

  return prisma.interview.update({
    where: { id: interviewId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.type && { type: data.type }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.time && { time: data.time }),
      ...(data.status && { status: data.status }),
      ...(data.link !== undefined && { link: data.link }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function deleteInterview(applicationId, interviewId, requestingUser) {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, applicationId },
  });
  if (!interview) throw new NotFoundError('Interview not found');

  if (requestingUser?.role === 'applicant' && requestingUser.applicationId !== applicationId) {
    throw new ForbiddenError();
  }

  await prisma.interview.delete({ where: { id: interviewId } });
  return { deleted: true };
}

export async function createMessage(applicationId, text, createdBy) {
  const exists = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Application not found');
  return prisma.applicationMessage.create({
    data: { applicationId, text, createdBy },
  });
}
