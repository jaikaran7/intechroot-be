import prisma from '../../config/db.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { getPagination, paginatedResponse } from '../../utils/pagination.js';

export async function getJobs(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.status) where.status = query.status;
  if (query.sector) where.sector = { contains: query.sector, mode: 'insensitive' };
  if (query.seniority) where.seniority = { contains: query.seniority, mode: 'insensitive' };
  if (query.contract) where.contract = query.contract;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({ where, skip, take: limit, orderBy: [{ displayOrder: 'asc' }, { postedDate: 'desc' }] }),
    prisma.job.count({ where }),
  ]);

  return paginatedResponse(jobs, total, page, limit);
}

export async function getJobById(id) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new NotFoundError('Job not found');
  return job;
}

export async function createJob(data) {
  const maxOrder = await prisma.job.aggregate({ _max: { displayOrder: true } });
  const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;
  return prisma.job.create({ data: { ...data, displayOrder: nextOrder } });
}

export async function updateJob(id, data) {
  await getJobById(id);
  return prisma.job.update({ where: { id }, data });
}

export async function updateJobStatus(id, status) {
  await getJobById(id);
  return prisma.job.update({ where: { id }, data: { status } });
}

export async function deleteJob(id) {
  await getJobById(id);
  await prisma.job.delete({ where: { id } });
}

export async function reorderJobs(orderedIds) {
  const existing = await prisma.job.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    throw new AppError('Some jobs in the reorder request were not found.', 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.job.update({
        where: { id },
        data: { displayOrder: idx },
      }),
    ),
  );
}
