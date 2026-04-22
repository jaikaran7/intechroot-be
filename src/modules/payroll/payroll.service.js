import prisma from '../../config/db.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

export async function getAllPayslips(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};
  if (query.employeeId) where.employeeId = query.employeeId;

  const [payslips, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      skip,
      take: limit,
      orderBy: { periodStart: 'desc' },
      include: { employee: { select: { id: true, name: true, role: true } } },
    }),
    prisma.payslip.count({ where }),
  ]);

  return paginatedResponse(payslips, total, page, limit);
}

export async function getEmployeePayslips(employeeId, query, requestingUser) {
  if (requestingUser?.role === 'employee' && requestingUser.employeeId !== employeeId) {
    throw new ForbiddenError();
  }
  const { page, limit, skip } = getPagination(query);
  const [payslips, total] = await Promise.all([
    prisma.payslip.findMany({ where: { employeeId }, skip, take: limit, orderBy: { periodStart: 'desc' } }),
    prisma.payslip.count({ where: { employeeId } }),
  ]);
  return paginatedResponse(payslips, total, page, limit);
}

export async function createPayslip(data) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new NotFoundError('Employee not found');

  return prisma.payslip.create({ data });
}
