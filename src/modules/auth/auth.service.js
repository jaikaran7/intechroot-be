import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/db.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import {
  AppError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../utils/errors.js';
import { resetYourPasswordEmail, sendEmail, getBaseUrl } from '../../utils/email.js';

// ─── Admin / Staff Auth ────────────────────────────────────

const ADMIN_PANEL_EMAIL = 'administrator@intechroot.com';

function resolveLoginRole(user) {
  return String(user.email || '').trim().toLowerCase() === ADMIN_PANEL_EMAIL ? 'ADMIN' : user.role;
}

export async function register({ email, password, name, role }, actingUser) {
  if (actingUser.role !== 'super_admin') {
    throw new ForbiddenError('Only super admins can create accounts');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return user;
}

export async function login({ email, password }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const resolvedRole = resolveLoginRole(user);

  // For employees, include employeeId in token payload
  let employee = null;
  if (resolvedRole === 'employee') {
    employee = await prisma.employee.findUnique({
      where: { email: user.email },
      select: { id: true, name: true, role: true, department: true },
    });
    if (!employee) throw new UnauthorizedError('Employee record not found');
  }

  const payload = {
    userId: user.id,
    role: resolvedRole,
    email: user.email,
    ...(employee && { employeeId: employee.id }),
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store hashed refresh token
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: resolvedRole },
    ...(employee && { employee }),
  };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {});
}

export async function refreshAccessToken(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { tokenHash } });
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

  const resolvedRole = resolveLoginRole(user);
  let employeeId;
  if (resolvedRole === 'employee') {
    const emp = await prisma.employee.findUnique({ where: { email: user.email }, select: { id: true } });
    employeeId = emp?.id;
  }
  const newPayload = { userId: user.id, role: resolvedRole, email: user.email, ...(employeeId && { employeeId }) };
  const newAccessToken = signAccessToken(newPayload);
  return { accessToken: newAccessToken };
}

// ─── Applicant Auth ────────────────────────────────────────

function applicantTokenPayload(application) {
  return {
    applicationId: application.id,
    role: 'applicant',
    email: application.email,
  };
}

function serializeApplicantSession(application) {
  return {
    accessToken: signAccessToken(applicantTokenPayload(application), {
      expiresIn: process.env.JWT_APPLICANT_ACCESS_EXPIRES_IN || '7d',
    }),
    application: {
      id: application.id,
      referenceId: application.referenceId,
      name: application.name,
      lifecycleStage: application.lifecycleStage,
      onboarding: application.onboarding,
    },
  };
}

/**
 * Applicant portal login:
 * - If no portal User: email-only after approval (or see applicantAcceptsAnyPassword).
 * - If portal User exists: bcrypt unless applicantAcceptsAnyPassword() (testing / no Resend).
 */
export async function applicantLogin({ email, password }) {
  const normalizedEmail = String(email ?? '')
    .toLowerCase()
    .trim();
  const pw = typeof password === 'string' ? password.trim() : '';

  const portalUser = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      role: 'applicant',
    },
  });

  const application = await prisma.application.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    orderBy: { appliedDate: 'desc' },
    include: { onboarding: true },
  });

  if (!application) {
    throw new UnauthorizedError('No application found for this email.');
  }

  if (/reject/i.test(application.status || '')) {
    throw new ForbiddenError(
      'This application is not active. Please contact the hiring team if you believe this is a mistake.'
    );
  }

  if (!application.portalApprovedAt) {
    throw new ForbiddenError(
      'Your application is pending administrator approval. Sign in will be available after approval.'
    );
  }

  // Applicant login is password-based once portal access is granted.
  if (!portalUser?.applicantApplicationId) {
    throw new ForbiddenError(
      'Applicant portal access is not enabled yet. Please wait for the approval email with your login credentials.'
    );
  }

  if (portalUser?.applicantApplicationId) {
    const linkedApp = await prisma.application.findUnique({
      where: { id: portalUser.applicantApplicationId },
      include: { onboarding: true },
    });
    if (!linkedApp) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (/reject/i.test(linkedApp.status || '')) {
      throw new ForbiddenError(
        'This application is not active. Please contact the hiring team if you believe this is a mistake.'
      );
    }
    if (!linkedApp.portalApprovedAt) {
      throw new ForbiddenError(
        'Your application is pending administrator approval. You will receive an email with login instructions when it is approved.'
      );
    }
    if (!portalUser.isActive) {
      throw new UnauthorizedError('Portal account is not active. Please contact support.');
    }

    if (!pw) {
      throw new AppError(
        'Password is required. Use the password from your approval email or reset it.',
        403,
        'APPLICANT_PASSWORD_REQUIRED'
      );
    }
    const valid = await bcrypt.compare(pw, portalUser.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');
    return serializeApplicantSession(linkedApp);
  }

  return serializeApplicantSession(application);
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function resetLinkForRole(token, role) {
  const base = getBaseUrl();
  if (role === 'applicant') return `${base}/applicant/reset-password?token=${encodeURIComponent(token)}`;
  return `${base}/reset-password?token=${encodeURIComponent(token)}&role=employee`;
}

export async function forgotPassword({ email, role }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const targetRole = role === 'applicant' ? 'applicant' : 'employee';

  // Always return success to prevent account enumeration.
  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user || user.role !== targetRole || !user.isActive) {
    return { sent: true };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  // Invalidate existing tokens for this user/role
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, role: targetRole, usedAt: null },
    data: { usedAt: new Date() },
  }).catch(() => {});

  await prisma.passwordResetToken.create({
    data: { userId: user.id, role: targetRole, tokenHash, expiresAt },
  });

  const link = resetLinkForRole(rawToken, targetRole);
  // In local/dev environments we often don't have email credentials configured.
  // Provide a safe debug link only when RESEND is not configured and we're not in production,
  // so QA/dev can still complete the reset flow end-to-end.
  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.warn('[auth] RESEND_API_KEY not set — returning debug reset link');
    return { sent: true, debugResetLink: link };
  }

  await sendEmail({
    to: user.email,
    ...resetYourPasswordEmail({
      fullName: user.name,
      resetLink: link,
      companyName: process.env.COMPANY_NAME,
    }),
  });

  return { sent: true };
}

export async function resetPassword({ token, password, role }) {
  const rawToken = String(token || '').trim();
  const pw = String(password || '');
  if (!rawToken) throw new AppError('Token is required', 400);

  const targetRole = role === 'applicant' ? 'applicant' : 'employee';
  const tokenHash = sha256(rawToken);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.role !== targetRole || row.usedAt) {
    throw new AppError('Reset token is invalid', 400);
  }
  if (row.expiresAt < new Date()) {
    throw new AppError('Reset token has expired', 400);
  }
  if (!row.user || !row.user.isActive) {
    throw new AppError('Account not found or inactive', 400);
  }

  const passwordHash = await bcrypt.hash(pw, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await tx.refreshToken.deleteMany({ where: { userId: row.userId } }).catch(() => {});
  });

  return { reset: true };
}

// ─── Employee Auth ─────────────────────────────────────────

export async function verifyEmployee({ email, password }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user || user.role !== 'employee' || !user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  const employee = await prisma.employee.findUnique({ where: { email: emailNorm } });
  if (!employee) throw new NotFoundError('Employee record not found');

  const payload = { userId: user.id, employeeId: employee.id, role: 'employee', email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
    employee: { id: employee.id, name: employee.name, role: employee.role },
  };
}
