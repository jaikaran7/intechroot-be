import prisma from '../../config/db.js';
import { NotFoundError, AppError, ForbiddenError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

function hourVal(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (v === 'L' || v === 'O') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function calculateTotal(weekData) {
  const wd = weekData || {};
  return (
    hourVal(wd.mon) +
    hourVal(wd.tue) +
    hourVal(wd.wed) +
    hourVal(wd.thu) +
    hourVal(wd.fri) +
    hourVal(wd.sat) +
    hourVal(wd.sun)
  );
}

/** YYYY-MM-DD → Date at UTC noon (stable calendar day). */
function dateFromYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const head = ymd.slice(0, 10);
  const [y, m, d] = head.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function periodBoundsFromBody(data) {
  if (data.periodStart && data.periodEnd) {
    return { periodStart: dateFromYmd(data.periodStart), periodEnd: dateFromYmd(data.periodEnd) };
  }
  return { periodStart: null, periodEnd: null };
}

export async function getAllTimesheets(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.status) {
    where.status = query.status;
  } else {
    where.status = { not: 'Draft' };
  }
  if (query.weekStart) where.weekStart = new Date(query.weekStart);
  if (query.employeeId) where.employeeId = query.employeeId;

  const [timesheets, total] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { weekStart: 'desc' },
      include: { employee: { select: { id: true, name: true, role: true, department: true } } },
    }),
    prisma.timesheet.count({ where }),
  ]);

  return paginatedResponse(timesheets, total, page, limit);
}

export async function getEmployeeTimesheets(employeeId, query, requestingUser) {
  if (requestingUser?.role === 'employee' && requestingUser.employeeId !== employeeId) {
    throw new ForbiddenError();
  }
  const { page, limit, skip } = getPagination(query);
  const where = { employeeId };
  if (query.status) where.status = query.status;

  const [timesheets, total] = await Promise.all([
    prisma.timesheet.findMany({ where, skip, take: limit, orderBy: { weekStart: 'desc' } }),
    prisma.timesheet.count({ where }),
  ]);

  return paginatedResponse(timesheets, total, page, limit);
}

/**
 * Create or update timesheet hours (employee only).
 * Draft / Rejected rows can be edited; Pending / Approved rows are locked for admin review.
 */
export async function saveTimesheetDraft(employeeId, data, requestingUser) {
  if (requestingUser?.role === 'employee' && requestingUser.employeeId !== employeeId) {
    throw new ForbiddenError();
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new NotFoundError('Employee not found');

  const weekStart = new Date(data.weekStart);
  const total = calculateTotal(data.weekData);
  const { periodStart, periodEnd } = periodBoundsFromBody(data);

  const existing = await prisma.timesheet.findUnique({
    where: { employeeId_weekStart: { employeeId, weekStart } },
  });

  if (existing && existing.status === 'Approved') {
    throw new AppError('This timesheet is already approved and cannot be edited.', 400);
  }

  if (existing && existing.status === 'Pending') {
    throw new AppError('This timesheet has already been submitted and is awaiting admin approval.', 400);
  }

  if (existing) {
    const nextStatus = existing.status === 'Rejected' ? 'Rejected' : 'Draft';
    return prisma.timesheet.update({
      where: { id: existing.id },
      data: {
        weekData: data.weekData,
        total,
        periodStart,
        periodEnd,
        status: nextStatus,
        rejectionNote: existing.status === 'Rejected' ? existing.rejectionNote : null,
        submittedAt: null,
      },
    });
  }

  return prisma.timesheet.create({
    data: {
      employeeId,
      weekStart,
      weekData: data.weekData,
      total,
      status: 'Draft',
      periodStart,
      periodEnd,
      submittedAt: null,
      rejectionNote: null,
    },
  });
}

/**
 * Move Draft or Rejected timesheet to Pending (visible to admins for review).
 */
export async function submitTimesheetForApproval(timesheetId, requestingUser) {
  if (requestingUser?.role !== 'employee' || !requestingUser.employeeId) {
    throw new ForbiddenError();
  }
  const employeeId = requestingUser.employeeId;

  const ts = await prisma.timesheet.findFirst({
    where: { id: timesheetId, employeeId },
  });
  if (!ts) throw new NotFoundError('Timesheet not found');
  if (ts.status !== 'Draft' && ts.status !== 'Rejected') {
    throw new AppError('Only draft or rejected timesheets can be sent for approval.', 400);
  }

  return prisma.timesheet.update({
    where: { id: timesheetId },
    data: {
      status: 'Pending',
      submittedAt: new Date(),
      rejectionNote: null,
    },
  });
}

export async function approveTimesheet(id) {
  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) throw new NotFoundError('Timesheet not found');
  if (ts.status === 'Approved') throw new AppError('Timesheet is already approved', 400);

  return prisma.timesheet.update({ where: { id }, data: { status: 'Approved', rejectionNote: null } });
}

export async function rejectTimesheet(id, rejectionNote) {
  const ts = await prisma.timesheet.findUnique({ where: { id } });
  if (!ts) throw new NotFoundError('Timesheet not found');

  return prisma.timesheet.update({ where: { id }, data: { status: 'Rejected', rejectionNote } });
}
