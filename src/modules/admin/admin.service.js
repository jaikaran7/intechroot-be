import prisma from '../../config/db.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';
import { internalPoolEmployeeWhere } from '../../utils/internalPool.js';

export async function getDashboardStats(requestingUser = null) {
  const isHrAdmin = requestingUser?.role === 'hr_admin';
  let assignedEmployeeIds = null;
  let assignedApplicationIds = null;
  if (isHrAdmin) {
    const [employeeRows, applicationRows] = await Promise.all([
      prisma.employeeAssignment.findMany({
        where: { adminUserId: requestingUser.userId, isActive: true },
        select: { employeeId: true },
      }),
      prisma.applicantAssignment.findMany({
        where: { adminUserId: requestingUser.userId, isActive: true },
        select: { applicationId: true },
      }),
    ]);
    assignedEmployeeIds = employeeRows.map((r) => r.employeeId);
    assignedApplicationIds = applicationRows.map((r) => r.applicationId);
  }

  const hrEmployeeWhere = { ...internalPoolEmployeeWhere(), status: 'Active' };
  const hrApplicationWhere = assignedApplicationIds?.length ? { id: { in: assignedApplicationIds } } : { id: { in: [] } };

  const [totalApplications, byStage, byDepartment, totalEmployees, pendingTimesheets, recentApplications] =
    await Promise.all([
      prisma.application.count({ ...(isHrAdmin ? { where: hrApplicationWhere } : {}) }),
      prisma.application.groupBy({
        by: ['lifecycleStage'],
        ...(isHrAdmin ? { where: hrApplicationWhere } : {}),
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ['department'],
        _count: { _all: true },
        ...(isHrAdmin ? { where: hrEmployeeWhere } : {}),
      }),
      prisma.employee.count({
        where: isHrAdmin ? hrEmployeeWhere : { status: 'Active' },
      }),
      isHrAdmin
        ? assignedEmployeeIds?.length
          ? prisma.timesheet.count({
              where: { status: 'Pending', employeeId: { in: assignedEmployeeIds } },
            })
          : Promise.resolve(0)
        : prisma.timesheet.count({ where: { status: 'Pending' } }),
      prisma.application.findMany({
        ...(isHrAdmin ? { where: hrApplicationWhere } : {}),
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

