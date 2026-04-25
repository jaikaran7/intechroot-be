/**
 * Ensures every Employee row has a matching User (role employee) so /auth/login works.
 * Sets password to the org default (Employee@123, or DEFAULT_EMPLOYEE_PORTAL_PASSWORD).
 *
 * Run: npm run db:backfill-employee-users
 * (from intechroot-be root, with DATABASE_URL in .env)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getDefaultEmployeePortalPassword } from '../src/utils/employeePortalDefaults.js';

const prisma = new PrismaClient();

async function main() {
  const plain = getDefaultEmployeePortalPassword();
  const passwordHash = await bcrypt.hash(plain, 12);
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: 'asc' } });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const emp of employees) {
    const emailLower = String(emp.email || '').trim().toLowerCase();
    if (!emailLower) {
      console.warn(`  [skip] employee ${emp.id} has no email`);
      skipped += 1;
      continue;
    }

    if (emailLower !== emp.email) {
      await prisma.employee.update({ where: { id: emp.id }, data: { email: emailLower } });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });

    if (!existing) {
      await prisma.user.create({
        data: {
          email: emailLower,
          name: emp.name || emailLower,
          passwordHash,
          role: 'employee',
          applicantApplicationId: null,
          isActive: true,
        },
      });
      console.log(`  [create] ${emailLower}`);
      created += 1;
      continue;
    }

    if (existing.role === 'super_admin' || existing.role === 'admin') {
      console.warn(`  [skip] ${emailLower} — already an admin/staff account`);
      skipped += 1;
      continue;
    }

    if (existing.role === 'employee') {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: emp.name || existing.name,
          role: 'employee',
          applicantApplicationId: null,
          isActive: true,
        },
      });
      console.log(`  [update-password] ${emailLower}`);
      updated += 1;
      continue;
    }

    if (existing.role === 'applicant') {
      const sameApplication =
        emp.applicationId && existing.applicantApplicationId === emp.applicationId;
      if (sameApplication || !existing.applicantApplicationId) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: emp.name || existing.name,
            role: 'employee',
            applicantApplicationId: null,
            isActive: true,
          },
        });
        console.log(`  [promote-applicant→employee] ${emailLower}`);
        updated += 1;
        continue;
      }
      console.warn(`  [skip] ${emailLower} — applicant user tied to another application`);
      skipped += 1;
      continue;
    }

    console.warn(`  [skip] ${emailLower} — unexpected role ${existing.role}`);
    skipped += 1;
  }

  console.log(`\nDone. created=${created} updated=${updated} skipped=${skipped} defaultPassword=<env or Employee@123>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
