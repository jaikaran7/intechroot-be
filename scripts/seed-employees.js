/**
 * Seed script — creates dummy employee users + employee records
 * Run once: node scripts/seed-employees.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMPLOYEES = [
  {
    user: { email: 'jaikaran@intechroot.com', password: 'Employee@123', name: 'Jaikaran' },
    employee: { name: 'Jaikaran', role: 'SAP Architect', department: 'Infrastructure', client: 'Client A', phone: '+49 176 459 293 88' },
  },
  {
    user: { email: 'badrinath@intechroot.com', password: 'Employee@123', name: 'Badrinath' },
    employee: { name: 'Badrinath', role: 'Cloud Solutions Lead', department: 'Strategy', client: 'Client B', phone: '+44 7700 900123' },
  },
  {
    user: { email: 'sanjay@intechroot.com', password: 'Employee@123', name: 'Sanjay' },
    employee: { name: 'Sanjay', role: 'Data Engineer', department: 'Engineering', client: 'Client C', phone: '+91 98765 43210' },
  },
];

async function main() {
  console.log('Seeding employee users...\n');

  for (const { user, employee } of EMPLOYEES) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      console.log(`  [skip] ${user.email} already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);

    // Create user account
    const createdUser = await prisma.user.create({
      data: { email: user.email, passwordHash, name: user.name, role: 'employee' },
    });

    // Create employee record linked to the user's email
    const createdEmployee = await prisma.employee.create({
      data: {
        name: employee.name,
        email: user.email,
        phone: employee.phone,
        role: employee.role,
        department: employee.department,
        client: employee.client,
        status: 'Active',
        personal: { dateOfBirth: '', gender: '', address: '' },
        employment: {
          employmentType: 'Full-Time',
          jobTitle: employee.role,
          shiftType: 'Standard',
          salary: '$120,000',
          payFrequency: 'Bi-Weekly',
          contractType: 'Permanent',
          contractTypeDescription: 'Full-time permanent contract',
          employmentStatus: 'Active Deployment',
          employmentStatusTag: 'active',
          joiningDate: '2024-01-15',
          contractEndDate: '2026-01-14',
        },
      },
    });

    console.log(`  [created] ${user.email} → employee ID: ${createdEmployee.id}`);
  }

  console.log('\nDone. Employee credentials:');
  EMPLOYEES.forEach(({ user }) => {
    console.log(`  Email: ${user.email}  |  Password: ${user.user?.password || 'Employee@123'}`);
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
