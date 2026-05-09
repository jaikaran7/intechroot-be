import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';
import { notifyEmployeeTimesheetRejected } from '../../utils/email.js';
import { internalPoolEmployeeWhere } from '../../utils/internalPool.js';
import {
  normalizePermissionsForUserRole,
  getNormalizedPermissionsForAdminUser,
} from '../../utils/panelPermissions.js';

export const ENTERPRISE_STAFF_ROLES = ['ADMIN', 'hr_admin'];
const APPLICATION_STAGE_ORDER = [
  'Application Submitted',
  'Profile Screening',
  'Technical Evaluation',
  'Client Interview',
  'Offer & Onboarding',
];

function requireAdminPanelUser(requestingUser) {
  if (!requestingUser || !ENTERPRISE_STAFF_ROLES.includes(requestingUser.role)) {
    throw new ForbiddenError(`Role '${requestingUser?.role || 'unknown'}' is not authorized for this action`);
  }
  return requestingUser.userId;
}

function requireSuperAdmin(requestingUser) {
  if (requestingUser?.role !== 'super_admin') {
    throw new ForbiddenError(`Role '${requestingUser?.role || 'unknown'}' is not authorized for this action`);
  }
}

function normalizeStatus(status, fallback = 'Active') {
  return String(status || fallback).toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

function serializeAdmin(user, profile = null, assignedCount = 0) {
  const status = profile?.status || (user.isActive ? 'Active' : 'Inactive');
  const adminKind = user.role === 'hr_admin' ? 'hr' : 'client';
  const roleLabel = user.role === 'hr_admin' ? 'HR Admin' : 'Client Admin';
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: profile?.company || '',
    phone: profile?.phone ?? '',
    adminKind,
    status,
    role: roleLabel,
    employees: assignedCount,
    employeesManaged: assignedCount,
    joined: `Joined ${new Date(user.createdAt).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    permissions: normalizePermissionsForUserRole(user.role, profile?.permissions || {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getAssignedEmployeeIds(adminUserId) {
  const assignments = await prisma.employeeAssignment.findMany({
    where: { adminUserId, isActive: true },
    select: { employeeId: true },
  });
  return assignments.map((assignment) => assignment.employeeId);
}

/**
 * Employee IDs whose timesheets this admin may see (admin-panel).
 * Mirrors HR scope on GET /employees: internal pool when `viewEmployeeDetails`, else assignments only.
 */
async function getPanelScopedEmployeeIds(adminUserId) {
  const user = await prisma.user.findUnique({ where: { id: adminUserId }, select: { role: true } });
  if (!user) return [];

  const assigned = await getAssignedEmployeeIds(adminUserId);
  if (user.role !== 'hr_admin') {
    return assigned;
  }

  const perms = await getNormalizedPermissionsForAdminUser(adminUserId);
  if (perms.viewEmployeeDetails) {
    const internalRows = await prisma.employee.findMany({
      where: internalPoolEmployeeWhere(),
      select: { id: true },
    });
    return [...new Set([...assigned, ...internalRows.map((r) => r.id)])];
  }
  return assigned;
}

async function getAssignedApplicationIds(adminUserId) {
  const assignments = await prisma.applicantAssignment.findMany({
    where: { adminUserId, isActive: true },
    select: { applicationId: true },
  });
  return assignments.map((assignment) => assignment.applicationId);
}

function resolveDisplayStage(application) {
  if (!application) return '';
  if (application.lifecycleStage === 'employee' || application.status === 'Employee') return 'Employee';
  const idx = Number(application.currentStageIndex);
  if (Number.isFinite(idx) && idx >= 0 && idx < APPLICATION_STAGE_ORDER.length) {
    return APPLICATION_STAGE_ORDER[idx];
  }
  return application.status || '';
}

function serializeAssignedApplicantRow(application) {
  return {
    id: application.id,
    name: application.name,
    email: application.email,
    status: application.status,
    stage: resolveDisplayStage(application),
    lifecycleStage: application.lifecycleStage,
    currentStageIndex: application.currentStageIndex,
  };
}

async function getAdminPermissions(adminUserId) {
  return getNormalizedPermissionsForAdminUser(adminUserId);
}

async function getAdminActivitySummary(adminUserId) {
  const scopedEmployeeIds = await getPanelScopedEmployeeIds(adminUserId);
  const assignedApplicationIds = await getAssignedApplicationIds(adminUserId);
  const where = scopedEmployeeIds.length ? { employeeId: { in: scopedEmployeeIds } } : { id: { in: [] } };
  const [approvalsDone, rejections, pending] = await Promise.all([
    prisma.timesheet.count({ where: { ...where, status: 'Approved' } }),
    prisma.timesheet.count({ where: { ...where, status: 'Rejected' } }),
    prisma.timesheet.count({ where: { ...where, status: 'Pending' } }),
  ]);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dayBuckets = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(today.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const count = await prisma.timesheet.count({
      where: {
        ...where,
        updatedAt: { gte: start, lte: end },
      },
    });
    dayBuckets.push({
      label: start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      count,
    });
  }

  return {
    approvalsDone,
    rejections,
    pending,
    applicantsManaged: assignedApplicationIds.length,
    pulse: dayBuckets,
  };
}

async function getAdminOrThrow(id) {
  const admin = await prisma.user.findFirst({ where: { id, role: { in: ENTERPRISE_STAFF_ROLES } } });
  if (!admin) throw new NotFoundError('Admin not found');
  return admin;
}

async function getAdminSummaries(users) {
  const adminIds = users.map((user) => user.id);
  if (adminIds.length === 0) return [];

  const [profiles, counts] = await Promise.all([
    prisma.adminProfile.findMany({ where: { adminUserId: { in: adminIds } } }),
    prisma.employeeAssignment.groupBy({
      by: ['adminUserId'],
      where: { adminUserId: { in: adminIds }, isActive: true },
      _count: { employeeId: true },
    }),
  ]);

  const profileByAdminId = new Map(profiles.map((profile) => [profile.adminUserId, profile]));
  const countByAdminId = new Map(counts.map((row) => [row.adminUserId, row._count.employeeId]));

  return users.map((user) => serializeAdmin(user, profileByAdminId.get(user.id), countByAdminId.get(user.id) || 0));
}

async function getAssignedTimesheetOrThrow(adminUserId, timesheetId) {
  const scopedEmployeeIds = await getPanelScopedEmployeeIds(adminUserId);
  if (scopedEmployeeIds.length === 0) {
    throw new NotFoundError('Timesheet not found');
  }

  const timesheet = await prisma.timesheet.findFirst({
    where: {
      id: timesheetId,
      employeeId: { in: scopedEmployeeIds },
    },
  });

  if (!timesheet) {
    throw new NotFoundError('Timesheet not found');
  }

  return timesheet;
}

export async function listAdmins(query, requestingUser) {
  requireSuperAdmin(requestingUser);
  const { page, limit, skip } = getPagination(query);
  const status = query.status && query.status !== 'All' ? normalizeStatus(query.status) : null;
  const search = String(query.search || '').trim();
  const kind = String(query.kind || 'all').toLowerCase();

  let roleClause;
  if (kind === 'client') roleClause = { role: 'ADMIN' };
  else if (kind === 'hr') roleClause = { role: 'hr_admin' };
  else roleClause = { role: { in: ENTERPRISE_STAFF_ROLES } };

  const userWhere = {
    ...roleClause,
    ...(status ? { isActive: status === 'Active' } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where: userWhere, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where: userWhere }),
  ]);

  const data = await getAdminSummaries(users);
  return paginatedResponse(data, total, page, limit);
}

export async function getAdmin(id, requestingUser) {
  requireSuperAdmin(requestingUser);
  const admin = await getAdminOrThrow(id);
  const [summary] = await getAdminSummaries([admin]);
  const activity = await getAdminActivitySummary(id);
  return {
    ...summary,
    permissions: normalizePermissionsForUserRole(admin.role, summary.permissions || {}),
    activity,
  };
}

export async function createAdmin(data, requestingUser) {
  requireSuperAdmin(requestingUser);
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '').trim();
  const name = String(data.name || '').trim();
  if (!email || !password || !name) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const adminKind = String(data.adminKind || 'client').toLowerCase();
  const isHr = adminKind === 'hr';
  const targetRole = isHr ? 'hr_admin' : 'ADMIN';

  if (!isHr && !String(data.company || '').trim()) {
    throw new AppError('Company is required for client admins', 400);
  }
  if (isHr && !String(data.phone || '').trim()) {
    throw new AppError('Phone is required for HR admins', 400);
  }

  const phone = String(data.phone || '').trim();
  const company = String(data.company || '').trim();

  const status = normalizeStatus(data.status);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !ENTERPRISE_STAFF_ROLES.includes(existing.role)) {
    throw new ConflictError('An account with this email already exists');
  }

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name,
          isActive: status === 'Active',
          role: targetRole,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: targetRole,
          isActive: status === 'Active',
        },
      });

  const profile = await prisma.adminProfile.upsert({
    where: { adminUserId: admin.id },
    update: {
      company: isHr ? '' : company,
      phone,
      status,
      permissions: normalizePermissionsForUserRole(targetRole === 'hr_admin' ? 'hr_admin' : 'ADMIN', data.permissions),
    },
    create: {
      adminUserId: admin.id,
      company: isHr ? '' : company,
      phone: phone || '',
      status,
      permissions: normalizePermissionsForUserRole(targetRole === 'hr_admin' ? 'hr_admin' : 'ADMIN', data.permissions),
    },
  });

  return serializeAdmin(admin, profile, 0);
}

export async function updateAdmin(id, data, requestingUser) {
  requireSuperAdmin(requestingUser);
  const targetUser = await getAdminOrThrow(id);

  const userData = {};
  if (data.name !== undefined) userData.name = String(data.name || '').trim();
  if (data.email !== undefined) userData.email = String(data.email || '').trim().toLowerCase();
  if (data.status !== undefined) userData.isActive = normalizeStatus(data.status) === 'Active';
  if (data.password) userData.passwordHash = await bcrypt.hash(String(data.password), 12);

  const admin = await prisma.user.update({
    where: { id },
    data: userData,
  });

  const profile = await prisma.adminProfile.upsert({
    where: { adminUserId: id },
    update: {
      ...(data.company !== undefined ? { company: String(data.company || '').trim() } : {}),
      ...(data.phone !== undefined ? { phone: String(data.phone || '').trim() } : {}),
      ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}),
      ...(data.permissions && typeof data.permissions === 'object'
        ? { permissions: normalizePermissionsForUserRole(targetUser.role, data.permissions) }
        : {}),
    },
    create: {
      adminUserId: id,
      company: String(data.company || '').trim(),
      phone: data.phone !== undefined ? String(data.phone || '').trim() : '',
      status: normalizeStatus(data.status, admin.isActive ? 'Active' : 'Inactive'),
      permissions: normalizePermissionsForUserRole(targetUser.role, data.permissions),
    },
  });

  const [summary] = await getAdminSummaries([admin]);
  const activity = await getAdminActivitySummary(id);
  return {
    ...summary,
    company: profile.company,
    phone: profile.phone ?? '',
    status: profile.status,
    permissions: normalizePermissionsForUserRole(admin.role, profile.permissions || {}),
    activity,
  };
}

export async function deleteAdmin(id, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);

  const admin = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  const profile = await prisma.adminProfile.upsert({
    where: { adminUserId: id },
    update: { status: 'Inactive' },
    create: { adminUserId: id, status: 'Inactive' },
  });

  return serializeAdmin(admin, profile, 0);
}

export async function listEmployees(query, requestingUser) {
  const { page, limit, skip } = getPagination(query);
  const search = String(query.search || '').trim();
  let where = {};

  if (requestingUser?.role === 'ADMIN' || requestingUser?.role === 'hr_admin') {
    const adminUserId = requireAdminPanelUser(requestingUser);
    const assignedEmployeeIds = await getAssignedEmployeeIds(adminUserId);
    console.log('[admin-panel] employees', { adminUserId, assignedEmployeeIds });
    where.id = assignedEmployeeIds.length ? { in: assignedEmployeeIds } : { in: [] };
  } else if (requestingUser?.role !== 'super_admin') {
    throw new ForbiddenError(`Role '${requestingUser?.role || 'unknown'}' is not authorized for this action`);
  }

  if (search) {
    where = {
      ...where,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.employee.count({ where }),
  ]);

  return paginatedResponse(employees, total, page, limit);
}

export async function getAdminAssignments(id, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);
  const assignedEmployeeIds = await getAssignedEmployeeIds(id);
  const employees = assignedEmployeeIds.length
    ? await prisma.employee.findMany({ where: { id: { in: assignedEmployeeIds } }, orderBy: { name: 'asc' } })
    : [];
  return { employeeIds: assignedEmployeeIds, employees };
}

export async function setAdminAssignments(id, employeeIds, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);
  const uniqueEmployeeIds = [...new Set((Array.isArray(employeeIds) ? employeeIds : []).map(String).filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    await tx.employeeAssignment.updateMany({
      where: { adminUserId: id, isActive: true },
      data: { isActive: false },
    });

    for (const employeeId of uniqueEmployeeIds) {
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!employee) throw new NotFoundError(`Employee not found: ${employeeId}`);
      await tx.employeeAssignment.upsert({
        where: { adminUserId_employeeId: { adminUserId: id, employeeId } },
        update: { isActive: true, assignedAt: new Date() },
        create: { adminUserId: id, employeeId, isActive: true },
      });
    }
  });

  return getAdminAssignments(id, requestingUser);
}

export async function getAdminApplicantAssignments(id, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);
  const [activeAssignments, assignedApplicationIds] = await Promise.all([
    prisma.applicantAssignment.findMany({
      where: { isActive: true },
      select: { adminUserId: true, applicationId: true },
    }),
    getAssignedApplicationIds(id),
  ]);
  const blockedApplicationIds = new Set(
    activeAssignments
      .filter((row) => row.adminUserId !== id)
      .map((row) => row.applicationId),
  );

  const [applicants, availableApplicants] = await Promise.all([
    assignedApplicationIds.length
      ? prisma.application.findMany({
          where: { id: { in: assignedApplicationIds } },
          orderBy: { appliedDate: 'desc' },
        })
      : Promise.resolve([]),
    prisma.application.findMany({
      where: { id: { notIn: [...blockedApplicationIds] } },
      orderBy: { appliedDate: 'desc' },
      take: 1000,
    }),
  ]);
  return {
    applicationIds: assignedApplicationIds,
    applicants: applicants.map(serializeAssignedApplicantRow),
    availableApplicants: availableApplicants.map(serializeAssignedApplicantRow),
  };
}

export async function setAdminApplicantAssignments(id, applicationIds, requestingUser) {
  requireSuperAdmin(requestingUser);
  const admin = await getAdminOrThrow(id);
  if (admin.role !== 'hr_admin') {
    throw new AppError('Applicants can only be assigned to HR admins', 400);
  }
  const uniqueApplicationIds = [...new Set((Array.isArray(applicationIds) ? applicationIds : []).map(String).filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    await tx.applicantAssignment.updateMany({
      where: { adminUserId: id, isActive: true },
      data: { isActive: false },
    });

    for (const applicationId of uniqueApplicationIds) {
      const application = await tx.application.findUnique({ where: { id: applicationId }, select: { id: true } });
      if (!application) throw new NotFoundError(`Application not found: ${applicationId}`);
      const assignedElsewhere = await tx.applicantAssignment.findFirst({
        where: { applicationId, isActive: true, adminUserId: { not: id } },
        select: { id: true },
      });
      if (assignedElsewhere) {
        throw new ConflictError('One or more applicants are already assigned to another HR admin');
      }
      await tx.applicantAssignment.upsert({
        where: { adminUserId_applicationId: { adminUserId: id, applicationId } },
        update: { isActive: true, assignedAt: new Date() },
        create: { adminUserId: id, applicationId, isActive: true },
      });
    }
  });

  return getAdminApplicantAssignments(id, requestingUser);
}

export async function removeAdminApplicantAssignment(id, applicationId, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);
  await prisma.applicantAssignment.updateMany({
    where: { adminUserId: id, applicationId: String(applicationId), isActive: true },
    data: { isActive: false },
  });
  return getAdminApplicantAssignments(id, requestingUser);
}

export async function getDashboard(requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const scopedEmployeeIds = await getPanelScopedEmployeeIds(adminUserId);

  const timesheetWhere = scopedEmployeeIds.length
    ? { employeeId: { in: scopedEmployeeIds }, status: { not: 'Draft' } }
    : { id: { in: [] } };

  const [adminUser, profile, employees, pendingTimesheets, approvedTimesheets, rejectedTimesheets, totalTimesheets] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: adminUserId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      prisma.adminProfile.findUnique({ where: { adminUserId } }),
      prisma.employee.findMany({
        where: { id: scopedEmployeeIds.length ? { in: scopedEmployeeIds } : { in: [] } },
        orderBy: { name: 'asc' },
      }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Pending' } }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Approved' } }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Rejected' } }),
      prisma.timesheet.count({ where: timesheetWhere }),
    ]);
  if (!adminUser) {
    throw new NotFoundError('Admin not found');
  }

  return {
    admin: {
      id: adminUserId,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
      company: profile?.company || '',
      phone: profile?.phone ?? '',
      status: profile?.status || 'Active',
    },
    assignedEmployees: employees.length,
    employees,
    permissions: normalizePermissionsForUserRole(adminUser.role, profile?.permissions || {}),
    timesheets: {
      total: totalTimesheets,
      pending: pendingTimesheets,
      approved: approvedTimesheets,
      rejected: rejectedTimesheets,
    },
  };
}

export async function getTimesheets(query, requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const scopedEmployeeIds = await getPanelScopedEmployeeIds(adminUserId);
  const { page, limit, skip } = getPagination(query);

  const where = {
    employeeId: scopedEmployeeIds.length ? { in: scopedEmployeeIds } : { in: [] },
    status: query.status || { not: 'Draft' },
  };

  if (query.weekStart) where.weekStart = new Date(query.weekStart);
  if (query.employeeId) {
    if (!scopedEmployeeIds.includes(query.employeeId)) {
      throw new ForbiddenError('Employee is not assigned to this admin');
    }
    where.employeeId = query.employeeId;
  }

  const [timesheets, total] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { weekStart: 'desc' },
      include: { employee: { select: { id: true, name: true, email: true, role: true, department: true } } },
    }),
    prisma.timesheet.count({ where }),
  ]);

  console.log('[admin-panel] timesheets', {
    adminUserId,
    scopedEmployeeIds,
    fetchedTimesheets: timesheets.map((timesheet) => timesheet.id),
  });

  return paginatedResponse(timesheets, total, page, limit);
}

export async function approveTimesheet(id, requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const permissions = await getAdminPermissions(adminUserId);
  if (!permissions.approveTimesheets && !permissions.editTimesheets) {
    throw new ForbiddenError('This admin is not allowed to approve timesheets');
  }
  const timesheet = await getAssignedTimesheetOrThrow(adminUserId, id);

  if (timesheet.status !== 'Pending') {
    throw new AppError('Only pending timesheets can be approved', 400);
  }

  return prisma.timesheet.update({
    where: { id },
    data: { status: 'Approved', rejectionNote: null },
  });
}

export async function rejectTimesheet(id, rejectionNote, requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const permissions = await getAdminPermissions(adminUserId);
  if (!permissions.rejectTimesheets && !permissions.editTimesheets) {
    throw new ForbiddenError('This admin is not allowed to reject timesheets');
  }
  const timesheet = await getAssignedTimesheetOrThrow(adminUserId, id);

  if (timesheet.status !== 'Pending') {
    throw new AppError('Only pending timesheets can be rejected', 400);
  }

  const employee = await prisma.employee.findUnique({
    where: { id: timesheet.employeeId },
    select: { email: true, name: true },
  });

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: 'Rejected', rejectionNote },
  });

  await notifyEmployeeTimesheetRejected(employee?.email, employee?.name, timesheet, rejectionNote);

  return updated;
}
