import prisma from '../../config/db.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

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

export async function updateEmployee(id, data) {
  await getEmployeeById(id, null);
  return prisma.employee.update({ where: { id }, data });
}

export async function updateEmployeeStatus(id, status) {
  await getEmployeeById(id, null);
  return prisma.employee.update({ where: { id }, data: { status } });
}
