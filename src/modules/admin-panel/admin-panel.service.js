import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

function requireAdminPanelUser(requestingUser) {
  if (requestingUser?.role !== 'ADMIN') {
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
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: profile?.company || '',
    status,
    role: 'Enterprise Admin',
    employees: assignedCount,
    employeesManaged: assignedCount,
    joined: `Joined ${new Date(user.createdAt).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    permissions: profile?.permissions || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function normalizePermissions(permissions = {}) {
  const value = permissions && typeof permissions === 'object' ? permissions : {};
  return {
    approveTimesheets: Boolean(value.approveTimesheets),
    rejectTimesheets: Boolean(value.rejectTimesheets),
    editTimesheets: false,
  };
}

async function getAssignedEmployeeIds(adminUserId) {
  const assignments = await prisma.employeeAssignment.findMany({
    where: { adminUserId, isActive: true },
    select: { employeeId: true },
  });
  return assignments.map((assignment) => assignment.employeeId);
}

async function getAdminPermissions(adminUserId) {
  const profile = await prisma.adminProfile.findUnique({ where: { adminUserId } });
  return normalizePermissions(profile?.permissions);
}

async function getAdminActivitySummary(adminUserId) {
  const assignedEmployeeIds = await getAssignedEmployeeIds(adminUserId);
  const where = assignedEmployeeIds.length ? { employeeId: { in: assignedEmployeeIds } } : { id: { in: [] } };
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

  return { approvalsDone, rejections, pending, pulse: dayBuckets };
}

async function getAdminOrThrow(id) {
  const admin = await prisma.user.findFirst({ where: { id, role: 'ADMIN' } });
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
  const assignedEmployeeIds = await getAssignedEmployeeIds(adminUserId);
  if (assignedEmployeeIds.length === 0) {
    throw new NotFoundError('Timesheet not found');
  }

  const timesheet = await prisma.timesheet.findFirst({
    where: {
      id: timesheetId,
      employeeId: { in: assignedEmployeeIds },
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

  const userWhere = {
    role: 'ADMIN',
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
  return { ...summary, permissions: normalizePermissions(summary.permissions), activity };
}

export async function createAdmin(data, requestingUser) {
  requireSuperAdmin(requestingUser);
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '').trim();
  const name = String(data.name || '').trim();
  if (!email || !password || !name) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const status = normalizeStatus(data.status);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') {
    throw new ConflictError('An account with this email already exists');
  }

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name,
          isActive: status === 'Active',
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN',
          isActive: status === 'Active',
        },
      });

  const profile = await prisma.adminProfile.upsert({
    where: { adminUserId: admin.id },
    update: {
      company: String(data.company || '').trim(),
      status,
      permissions: normalizePermissions(data.permissions),
    },
    create: {
      adminUserId: admin.id,
      company: String(data.company || '').trim(),
      status,
      permissions: normalizePermissions(data.permissions),
    },
  });

  return serializeAdmin(admin, profile, 0);
}

export async function updateAdmin(id, data, requestingUser) {
  requireSuperAdmin(requestingUser);
  await getAdminOrThrow(id);

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
      ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}),
      ...(data.permissions && typeof data.permissions === 'object' ? { permissions: normalizePermissions(data.permissions) } : {}),
    },
    create: {
      adminUserId: id,
      company: String(data.company || '').trim(),
      status: normalizeStatus(data.status, admin.isActive ? 'Active' : 'Inactive'),
      permissions: normalizePermissions(data.permissions),
    },
  });

  const [summary] = await getAdminSummaries([admin]);
  const activity = await getAdminActivitySummary(id);
  return { ...summary, company: profile.company, status: profile.status, permissions: normalizePermissions(profile.permissions), activity };
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

  if (requestingUser?.role === 'ADMIN') {
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

export async function getDashboard(requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const assignedEmployeeIds = await getAssignedEmployeeIds(adminUserId);

  const timesheetWhere = assignedEmployeeIds.length
    ? { employeeId: { in: assignedEmployeeIds }, status: { not: 'Draft' } }
    : { id: { in: [] } };

  const [employees, pendingTimesheets, approvedTimesheets, rejectedTimesheets, totalTimesheets] =
    await Promise.all([
      prisma.employee.findMany({
        where: { id: assignedEmployeeIds.length ? { in: assignedEmployeeIds } : { in: [] } },
        orderBy: { name: 'asc' },
      }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Pending' } }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Approved' } }),
      prisma.timesheet.count({ where: { ...timesheetWhere, status: 'Rejected' } }),
      prisma.timesheet.count({ where: timesheetWhere }),
    ]);
  const profile = await prisma.adminProfile.findUnique({ where: { adminUserId } });

  return {
    admin: {
      id: adminUserId,
      company: profile?.company || '',
      status: profile?.status || 'Active',
    },
    assignedEmployees: employees.length,
    employees,
    permissions: normalizePermissions(profile?.permissions),
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
  const assignedEmployeeIds = await getAssignedEmployeeIds(adminUserId);
  const { page, limit, skip } = getPagination(query);

  const where = {
    employeeId: assignedEmployeeIds.length ? { in: assignedEmployeeIds } : { in: [] },
    status: query.status || { not: 'Draft' },
  };

  if (query.weekStart) where.weekStart = new Date(query.weekStart);
  if (query.employeeId) {
    if (!assignedEmployeeIds.includes(query.employeeId)) {
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
    assignedEmployeeIds,
    fetchedTimesheets: timesheets.map((timesheet) => timesheet.id),
  });

  return paginatedResponse(timesheets, total, page, limit);
}

export async function approveTimesheet(id, requestingUser) {
  const adminUserId = requireAdminPanelUser(requestingUser);
  const permissions = await getAdminPermissions(adminUserId);
  if (!permissions.approveTimesheets) {
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
  if (!permissions.rejectTimesheets) {
    throw new ForbiddenError('This admin is not allowed to reject timesheets');
  }
  const timesheet = await getAssignedTimesheetOrThrow(adminUserId, id);

  if (timesheet.status !== 'Pending') {
    throw new AppError('Only pending timesheets can be rejected', 400);
  }

  return prisma.timesheet.update({
    where: { id },
    data: { status: 'Rejected', rejectionNote },
  });
}
