import prisma from '../../config/db.js';
import { NotFoundError, ForbiddenError, AppError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

function asObjectRecord(value) {
  if (value == null) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  return {};
}

export async function getEmployees(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { role: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.department) where.department = { contains: query.department, mode: 'insensitive' };
  if (query.status) where.status = query.status;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        timesheets: { orderBy: { weekStart: 'desc' }, take: 1 },
        _count: { select: { timesheets: true, documents: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  return paginatedResponse(employees, total, page, limit);
}

export async function getEmployeeById(id, requestingUser) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      timesheets: { orderBy: { weekStart: 'desc' } },
      documents: true,
      payslips: { orderBy: { periodStart: 'desc' } },
      extraDocumentRequests: {
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!employee) throw new NotFoundError('Employee not found');

  // Employee can only view their own record
  if (requestingUser?.role === 'employee' && requestingUser.employeeId !== id) {
    throw new ForbiddenError();
  }

  let applicationProfile = null;
  if (employee.applicationId) {
    applicationProfile = await prisma.application.findUnique({
      where: { id: employee.applicationId },
      select: {
        id: true,
        dateOfBirth: true,
        gender: true,
        adminDocRequests: {
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  return { ...employee, applicationProfile };
}

const EMPLOYMENT_FLAT_KEYS = [
  'employmentType',
  'jobTitle',
  'shiftType',
  'salary',
  'payFrequency',
  'contractType',
  'contractTypeDescription',
  'employmentStatus',
  'employmentStatusTag',
  'joiningDate',
  'contractEndDate',
  'directManager',
];

/** @param {object | null} [requestingUser] */
export async function updateEmployee(id, body, requestingUser = null) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Employee not found');

  if (requestingUser?.role === 'employee' && requestingUser.employeeId !== id) {
    throw new ForbiddenError();
  }

  const isEmployee = requestingUser?.role === 'employee';
  const existingPersonal = asObjectRecord(existing.personal);
  const existingEmployment = asObjectRecord(existing.employment);

  if (isEmployee) {
    const nextAddress =
      body.personal?.address !== undefined
        ? body.personal.address
        : body.address !== undefined
          ? body.address
          : existingPersonal.address;

    const personal = {
      ...existingPersonal,
      address: nextAddress ?? '',
    };

    const data = { personal };
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.email !== undefined) data.email = body.email;

    return prisma.employee.update({ where: { id }, data });
  }

  let personal = { ...existingPersonal };
  let employment = { ...existingEmployment };

  if (body.personal && typeof body.personal === 'object') {
    Object.assign(personal, body.personal);
  }
  for (const key of ['dateOfBirth', 'gender', 'address']) {
    if (body[key] !== undefined) personal[key] = body[key];
  }

  if (body.employment && typeof body.employment === 'object') {
    Object.assign(employment, body.employment);
  }
  for (const key of EMPLOYMENT_FLAT_KEYS) {
    if (body[key] !== undefined) employment[key] = body[key];
  }

  const data = { personal, employment };
  if (body.name !== undefined) data.name = body.name;
  if (body.department !== undefined) data.department = body.department;
  if (body.client !== undefined) data.client = body.client;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.email !== undefined) data.email = body.email;
  if (body.role !== undefined) data.role = body.role;
  if (body.jobTitle !== undefined) data.role = body.jobTitle;

  return prisma.employee.update({ where: { id }, data });
}

export async function updateEmployeeStatus(id, status) {
  await getEmployeeById(id, null);
  return prisma.employee.update({ where: { id }, data: { status } });
}

/** Admin or employee adds an extra document row for this employee (no application link required). */
export async function addEmployeeExtraDocumentRequest(employeeId, name, requestingUser) {
  const role = requestingUser?.role;
  if (role === 'employee') {
    if (requestingUser.employeeId !== employeeId) throw new ForbiddenError();
  } else if (!['admin', 'super_admin'].includes(role)) {
    throw new ForbiddenError();
  }

  const trimmed = String(name || '').trim();
  if (!trimmed) throw new AppError('Document name is required', 400);

  const exists = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Employee not found');

  return prisma.employeeExtraDocumentRequest.create({
    data: { employeeId, name: trimmed },
  });
}

