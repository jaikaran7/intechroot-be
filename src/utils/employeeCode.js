/** Calendar year as two digits (e.g. 26 for 2026). */
export function currentYear2() {
  return String(new Date().getFullYear()).slice(-2);
}

export function generateEmployeeCode(year2, numericSuffix) {
  return `INTR-${year2}-${String(numericSuffix).padStart(4, '0')}`;
}

/**
 * Next sequential employee code for the current year (INTR-YY-0001).
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} db
 */
export async function allocateNextEmployeeCode(db) {
  const yy = currentYear2();
  const prefix = `INTR-${yy}-`;
  const lastForYear = await db.employee.findFirst({
    where: { employeeCode: { startsWith: prefix } },
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });
  const lastNum = lastForYear?.employeeCode
    ? Number(String(lastForYear.employeeCode).slice(prefix.length))
    : 0;
  return generateEmployeeCode(yy, (Number.isFinite(lastNum) ? lastNum : 0) + 1);
}
