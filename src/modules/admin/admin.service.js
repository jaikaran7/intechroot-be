import prisma from '../../config/db.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

export async function getDashboardStats() {
  const [
    totalApplications,
    byStage,
    byDepartment,
    totalEmployees,
    pendingTimesheets,
    recentApplications,
  ] = await Promise.all([
    prisma.application.count(),
    prisma.application.groupBy({
      by: ['lifecycleStage'],
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ['department'],
      _count: { _all: true },
    }),
    prisma.employee.count({ where: { status: 'Active' } }),
    prisma.timesheet.count({ where: { status: 'Pending' } }),
    prisma.application.findMany({
      take: 5,
      orderBy: { appliedDate: 'desc' },
      select: {
        id: true,
        referenceId: true,
        name: true,
        role: true,
        location: true,
        lifecycleStage: true,
        status: true,
        appliedDate: true,
      },
    }),
  ]);

  const stageMap = {};
  for (const entry of byStage) {
    stageMap[entry.lifecycleStage] = entry._count._all;
  }

  const deptMap = {};
  for (const entry of byDepartment) {
    deptMap[entry.department] = entry._count._all;
  }

  return {
    pipeline: {
      total: totalApplications,
      applied: stageMap.applied || 0,
      screening: stageMap.screening || 0,
      technical: stageMap.technical || 0,
      client: stageMap.client || 0,
      offer: stageMap.offer || 0,
      onboarding: stageMap.onboarding || 0,
      hired: stageMap.employee || 0,
    },
    employees: {
      total: totalEmployees,
      byDepartment: deptMap,
    },
    pendingTimesheets,
    recentApplications,
    /** Reserved for payroll module; when null/missing, clients show a non-misleading empty state. */
    payroll: null,
  };
}

export async function getPipelineReport(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};
  if (query.lifecycleStage) where.lifecycleStage = query.lifecycleStage;
  if (query.from) where.appliedDate = { gte: new Date(query.from) };
  if (query.to) where.appliedDate = { ...where.appliedDate, lte: new Date(query.to) };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: { appliedDate: 'desc' },
      select: {
        id: true, referenceId: true, name: true, role: true,
        lifecycleStage: true, appliedDate: true, currentStageIndex: true,
      },
    }),
    prisma.application.count({ where }),
  ]);

  return paginatedResponse(applications, total, page, limit);
}

