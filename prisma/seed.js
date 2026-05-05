/**
 * Seed file — IntechRoot dev/test data.
 * Run: node prisma/seed.js
 *
 * Creates (idempotent — uses referenceId / email unique constraints):
 *   - 1 super_admin  (credentials from env: SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD)
 *   - 1 admin        (ADMIN_EMAIL / ADMIN_PASSWORD, defaults provided)
 *   - 3 employees    (2 full, 1 sparse) + corresponding User records
 *   - 3 applications (different pipeline stages)
 *   - 6 job postings (idempotent by title)
 *
 * All entity writes are in a single transaction.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const prisma = new PrismaClient();
const __dir = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL    = process.env.SUPER_ADMIN_EMAIL    || 'superadmin@intechroot.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const ADMIN_EMAIL          = process.env.ADMIN_EMAIL          || 'admin@intechroot.com';
const ADMIN_PASSWORD       = process.env.ADMIN_PASSWORD       || 'Admin@123';
const ADMIN_PANEL_EMAIL    = process.env.ADMIN_PANEL_EMAIL    || 'administrator@intechroot.com';
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || 'Administrator@123';

// ── Helpers ────────────────────────────────────────────────────────────────────

const hash = (pw) => bcrypt.hash(pw, 12);

function writeFixture(filename, data) {
  const dir = resolve(__dir, '../../IntechRoot-FE/src/fixtures/seed-data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), JSON.stringify(data, null, 2));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database…');

  const [superPwHash, adminPwHash, adminPanelPwHash, emp1PwHash, emp2PwHash, emp3PwHash] = await Promise.all([
    hash(SUPER_ADMIN_PASSWORD),
    hash(ADMIN_PASSWORD),
    hash(ADMIN_PANEL_PASSWORD),
    hash('Employee1@123'),
    hash('Employee2@123'),
    hash('Employee3@123'),
  ]);

  await prisma.$transaction(async (tx) => {

    // ── Admin users ──────────────────────────────────────────────────────────

    await tx.user.upsert({
      where: { email: SUPER_ADMIN_EMAIL },
      update: {},
      create: { email: SUPER_ADMIN_EMAIL, passwordHash: superPwHash, name: 'Super Admin', role: 'super_admin', isActive: true },
    });

    await tx.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {},
      create: { email: ADMIN_EMAIL, passwordHash: adminPwHash, name: 'Platform Admin', role: 'admin', isActive: true },
    });

    const adminPanelUser = await tx.user.upsert({
      where: { email: ADMIN_PANEL_EMAIL },
      update: {},
      create: {
        email: ADMIN_PANEL_EMAIL,
        passwordHash: adminPanelPwHash,
        name: 'Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    });

    await tx.adminProfile.upsert({
      where: { adminUserId: adminPanelUser.id },
      update: { company: 'InTechRoot', status: 'Active' },
      create: {
        adminUserId: adminPanelUser.id,
        company: 'InTechRoot',
        status: 'Active',
        permissions: { approveTimesheets: true, rejectTimesheets: true, editTimesheets: false },
      },
    });

    const assignedEmployeeOne = await tx.employee.upsert({
      where: { email: 'admin.panel.employee1@intechroot.com' },
      update: {},
      create: {
        name: 'Admin Panel Employee One',
        email: 'admin.panel.employee1@intechroot.com',
        phone: '+1-555-300-0001',
        role: 'Frontend Engineer',
        department: 'Engineering',
        client: 'InTechRoot',
        personal: {},
        employment: { employmentType: 'Full-Time', jobTitle: 'Frontend Engineer' },
      },
    });

    const assignedEmployeeTwo = await tx.employee.upsert({
      where: { email: 'admin.panel.employee2@intechroot.com' },
      update: {},
      create: {
        name: 'Admin Panel Employee Two',
        email: 'admin.panel.employee2@intechroot.com',
        phone: '+1-555-300-0002',
        role: 'Backend Engineer',
        department: 'Engineering',
        client: 'InTechRoot',
        personal: {},
        employment: { employmentType: 'Full-Time', jobTitle: 'Backend Engineer' },
      },
    });

    await tx.employeeAssignment.upsert({
      where: {
        adminUserId_employeeId: {
          adminUserId: adminPanelUser.id,
          employeeId: assignedEmployeeOne.id,
        },
      },
      update: { isActive: true },
      create: {
        adminUserId: adminPanelUser.id,
        employeeId: assignedEmployeeOne.id,
        isActive: true,
      },
    });

    await tx.employeeAssignment.upsert({
      where: {
        adminUserId_employeeId: {
          adminUserId: adminPanelUser.id,
          employeeId: assignedEmployeeTwo.id,
        },
      },
      update: { isActive: true },
      create: {
        adminUserId: adminPanelUser.id,
        employeeId: assignedEmployeeTwo.id,
        isActive: true,
      },
    });

    // ── Employee users + records ─────────────────────────────────────────────

    await tx.user.upsert({
      where: { email: 'jane.doe@intechroot.com' },
      update: {},
      create: { email: 'jane.doe@intechroot.com', passwordHash: emp1PwHash, name: 'Jane Doe', role: 'employee', isActive: true },
    });

    await tx.employee.upsert({
      where: { email: 'jane.doe@intechroot.com' },
      update: {},
      create: {
        name: 'Jane Doe',
        email: 'jane.doe@intechroot.com',
        phone: '+1-555-100-0001',
        role: 'Senior Frontend Developer',
        department: 'Engineering',
        client: 'Acme Corp',
        personal: { dateOfBirth: '1990-06-15', gender: 'Female', address: '123 Oak Street, Austin, TX 78701' },
        employment: { employmentType: 'Full-Time', jobTitle: 'Senior Frontend Developer', joiningDate: new Date('2023-01-10').toISOString(), experience: '7 years' },
      },
    });

    await tx.user.upsert({
      where: { email: 'mark.smith@intechroot.com' },
      update: {},
      create: { email: 'mark.smith@intechroot.com', passwordHash: emp2PwHash, name: 'Mark Smith', role: 'employee', isActive: true },
    });

    await tx.employee.upsert({
      where: { email: 'mark.smith@intechroot.com' },
      update: {},
      create: {
        name: 'Mark Smith',
        email: 'mark.smith@intechroot.com',
        phone: '+1-555-100-0002',
        role: 'Backend Engineer',
        department: 'Engineering',
        client: 'TechFlow Inc.',
        personal: { dateOfBirth: '1988-03-22', gender: 'Male', address: '456 Pine Ave, Seattle, WA 98101' },
        employment: { employmentType: 'Full-Time', jobTitle: 'Backend Engineer', joiningDate: new Date('2022-07-01').toISOString(), experience: '9 years' },
      },
    });

    await tx.user.upsert({
      where: { email: 'alex.j@intechroot.com' },
      update: {},
      create: { email: 'alex.j@intechroot.com', passwordHash: emp3PwHash, name: 'Alex J', role: 'employee', isActive: true },
    });

    await tx.employee.upsert({
      where: { email: 'alex.j@intechroot.com' },
      update: {},
      create: {
        name: 'Alex J',
        email: 'alex.j@intechroot.com',
        phone: '',
        role: 'QA Engineer',
        department: 'Quality Assurance',
        personal: {},
        employment: { employmentType: 'Contract', jobTitle: 'QA Engineer', joiningDate: new Date('2024-03-01').toISOString() },
      },
    });

    // ── Applications ─────────────────────────────────────────────────────────

    // App 1 — Profile Screening (stage index 1)
    const existing1 = await tx.application.findUnique({ where: { referenceId: 'ITR-SEED-001' } });
    if (!existing1) {
      await tx.application.create({
        data: {
          referenceId: 'ITR-SEED-001',
          name: 'Alice Chen',
          email: 'alice.chen@example.com',
          phone: '+1-555-200-0001',
          role: 'Full Stack Developer',
          experience: '5 years',
          location: 'San Francisco, CA',
          status: 'In Review',
          lifecycleStage: 'screening',
          currentStageIndex: 1,
          skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
          stages: {
            create: [
              { name: 'Application Submitted', date: new Date('2024-11-01').toISOString() },
              { name: 'Profile Screening',     date: new Date('2024-11-05').toISOString() },
            ],
          },
        },
      });
    }

    // App 2 — Client Interview (stage index 3)
    const existing2 = await tx.application.findUnique({ where: { referenceId: 'ITR-SEED-002' } });
    if (!existing2) {
      await tx.application.create({
        data: {
          referenceId: 'ITR-SEED-002',
          name: 'Bob Kim',
          email: 'bob.kim@example.com',
          phone: '+1-555-200-0002',
          role: 'DevOps Engineer',
          experience: '8 years',
          location: 'New York, NY',
          status: 'In Review',
          lifecycleStage: 'client',
          currentStageIndex: 3,
          skills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD'],
          stages: {
            create: [
              { name: 'Application Submitted', date: new Date('2024-10-15').toISOString() },
              { name: 'Profile Screening',     date: new Date('2024-10-18').toISOString() },
              { name: 'Technical Evaluation',  date: new Date('2024-10-25').toISOString() },
              { name: 'Client Interview',      date: new Date('2024-11-02').toISOString() },
            ],
          },
        },
      });
    }

    // App 3 — Offer & Onboarding (stage index 4, onboarding enabled)
    const existing3 = await tx.application.findUnique({ where: { referenceId: 'ITR-SEED-003' } });
    if (!existing3) {
      await tx.application.create({
        data: {
          referenceId: 'ITR-SEED-003',
          name: 'Diana Ross',
          email: 'diana.ross@example.com',
          phone: '+1-555-200-0003',
          role: 'Product Designer',
          experience: '6 years',
          location: 'Chicago, IL',
          status: 'In Review',
          lifecycleStage: 'onboarding',
          currentStageIndex: 4,
          skills: ['Figma', 'UX Research', 'Prototyping', 'Design Systems'],
          stages: {
            create: [
              { name: 'Application Submitted', date: new Date('2024-09-20').toISOString() },
              { name: 'Profile Screening',     date: new Date('2024-09-24').toISOString() },
              { name: 'Technical Evaluation',  date: new Date('2024-10-01').toISOString() },
              { name: 'Client Interview',      date: new Date('2024-10-10').toISOString() },
              { name: 'Offer & Onboarding',    date: new Date('2024-10-20').toISOString() },
            ],
          },
          onboarding: {
            create: {
              enabled: true,
              step: 1,
              profileCompleted: false,
              documentsCompleted: false,
              bgvCompleted: false,
              bgvApplicantAcknowledged: false,
              finalSubmitted: false,
              hireCompleted: false,
            },
          },
        },
      });
    }

    // ── Job postings (model: Job) ─────────────────────────────────────────────

    const jobs = [
      {
        title: 'Senior React Developer',
        sector: 'Engineering',
        category: 'Frontend',
        seniority: '5-8 years',
        contract: 'Permanent',
        jobType: 'Full-time',
        location: 'Remote (US)',
        status: 'Active',
        featured: false,
        description:
          'Lead delivery of mission-critical React experiences for global enterprise programs.\n\nYou will partner with product and design to ship accessible, performant interfaces, define front-end architecture patterns, and mentor engineers on modern TypeScript and testing practices.\n\nThis role suits someone who thrives in fast feedback cycles and cares deeply about operational excellence in the browser.',
        requirements: ['5+ years React', 'TypeScript', 'REST/GraphQL APIs'],
        skills: ['React', 'TypeScript', 'Next.js'],
        experience: '5-8 years',
      },
      {
        title: 'Cloud Infrastructure Engineer',
        sector: 'DevOps',
        category: 'Infrastructure',
        seniority: '3-5 years',
        contract: 'Permanent',
        jobType: 'Full-time',
        location: 'Austin, TX / Hybrid',
        status: 'Active',
        featured: false,
        description:
          'Design, implement, and operate resilient cloud foundations across AWS and GCP.\n\nYou will own infrastructure-as-code pipelines, cost and reliability guardrails, and incident response playbooks while collaborating with application teams on secure deployment patterns.\n\nIdeal candidates bring hands-on Kubernetes experience and a pragmatic approach to platform engineering at scale.',
        requirements: ['AWS / GCP', 'Terraform', 'Kubernetes'],
        skills: ['AWS', 'Terraform', 'Kubernetes'],
        experience: '3-5 years',
      },
      {
        title: 'UX / Product Designer',
        sector: 'Design',
        category: 'Product Design',
        seniority: '3-5 years',
        contract: 'Permanent',
        jobType: 'Full-time',
        location: 'New York, NY / Remote',
        status: 'Closed',
        featured: false,
        description:
          'Drive end-to-end product design for complex B2B workflows—from discovery through delivery.\n\nYou will facilitate research sessions, translate insights into flows and prototypes in Figma, and steward a cohesive design system alongside engineering partners.\n\nThis posting is closed for new applicants; descriptions remain for portfolio reference.',
        requirements: ['Figma', 'User research', 'Design systems'],
        skills: ['Figma', 'UX Research', 'Prototyping'],
        experience: '3-5 years',
      },
      {
        title: 'Staff Data Engineer',
        sector: 'Data',
        category: 'Data',
        seniority: '5-8 years',
        contract: 'Permanent',
        jobType: 'Full-time',
        location: 'Remote (US / EU)',
        status: 'Active',
        featured: true,
        description:
          'Own the analytics data plane for InTechRoot clients: ingestion, modeling, and quality at scale.\n\nYou will design batch and streaming pipelines, implement dbt models in Snowflake/BigQuery, and partner with analytics teams on SLAs and lineage.\n\nWe value pragmatic automation, clear documentation, and collaborative code review in a globally distributed team.',
        requirements: ['SQL', 'dbt', 'Airflow or Dagster', 'Snowflake/BigQuery'],
        skills: ['SQL', 'Python', 'dbt', 'Airflow'],
        experience: '5-8 years',
      },
      {
        title: 'Principal Security Architect',
        sector: 'Security',
        category: 'Security',
        seniority: '8+ years',
        contract: 'Permanent',
        jobType: 'Full-time',
        location: 'Hybrid — Washington, DC',
        status: 'Active',
        featured: true,
        description:
          'Set the security architecture direction for regulated and high-trust customer programs.\n\nYou will lead threat modeling workshops, define zero-trust controls for hybrid cloud estates, and advise delivery teams on identity, data protection, and audit readiness.\n\nThis is a senior individual contributor track with visibility to executive stakeholders and space to shape methodology across engagements.',
        requirements: ['Threat modeling', 'Cloud security', 'Regulatory experience'],
        skills: ['Zero Trust', 'AWS Security', 'IAM', 'SOC2'],
        experience: '8+ years',
      },
      {
        title: 'AI / ML Platform Engineer',
        sector: 'Engineering',
        category: 'Data',
        seniority: '3-5 years',
        contract: 'Consulting',
        jobType: 'Contract',
        location: 'Remote',
        status: 'Active',
        featured: true,
        description:
          'Build the internal ML platform that powers model lifecycle, deployment, and observability.\n\nYou will integrate training and inference services on Kubernetes, harden GPU scheduling paths, and collaborate with research teams on packaging and rollout.\n\nThis contract role suits engineers who enjoy bridging ML research constraints with production-grade platform patterns.',
        requirements: ['Python', 'Kubernetes', 'CUDA or Triton familiarity'],
        skills: ['Python', 'Kubernetes', 'MLflow', 'PyTorch'],
        experience: '3-5 years',
      },
    ];

    for (const [idx, job] of jobs.entries()) {
      const { title, ...rest } = job;
      const existing = await tx.job.findFirst({ where: { title } });
      if (existing) {
        await tx.job.update({ where: { id: existing.id }, data: { title, ...rest, displayOrder: idx } });
      } else {
        await tx.job.create({ data: { title, ...rest, displayOrder: idx } });
      }
    }
  }, { timeout: 30_000 });

  console.log('✅ Seed complete.');

  // ── Write reference fixture files ─────────────────────────────────────────

  writeFixture('admins.json', [
    { email: SUPER_ADMIN_EMAIL, role: 'super_admin' },
    { email: ADMIN_EMAIL,       role: 'admin'        },
    { email: ADMIN_PANEL_EMAIL, role: 'ADMIN'        },
  ]);

  writeFixture('employees.json', [
    { name: 'Jane Doe',   email: 'jane.doe@intechroot.com',   role: 'Senior Frontend Developer', department: 'Engineering',        defaultPassword: 'Employee1@123' },
    { name: 'Mark Smith', email: 'mark.smith@intechroot.com', role: 'Backend Engineer',           department: 'Engineering',        defaultPassword: 'Employee2@123' },
    { name: 'Alex J',     email: 'alex.j@intechroot.com',     role: 'QA Engineer',                department: 'Quality Assurance',  defaultPassword: 'Employee3@123' },
    { name: 'Admin Panel Employee One', email: 'admin.panel.employee1@intechroot.com', role: 'Frontend Engineer', department: 'Engineering' },
    { name: 'Admin Panel Employee Two', email: 'admin.panel.employee2@intechroot.com', role: 'Backend Engineer', department: 'Engineering' },
  ]);

  writeFixture('applications.json', [
    { referenceId: 'ITR-SEED-001', name: 'Alice Chen',  email: 'alice.chen@example.com',  stage: 'Profile Screening',  stageIndex: 1 },
    { referenceId: 'ITR-SEED-002', name: 'Bob Kim',     email: 'bob.kim@example.com',     stage: 'Client Interview',   stageIndex: 3 },
    { referenceId: 'ITR-SEED-003', name: 'Diana Ross',  email: 'diana.ross@example.com',  stage: 'Offer & Onboarding', stageIndex: 4, onboardingEnabled: true },
  ]);

  writeFixture('jobs.json', [
    { title: 'Senior React Developer', sector: 'Engineering', status: 'Active' },
    { title: 'Cloud Infrastructure Engineer', sector: 'DevOps', status: 'Active' },
    { title: 'UX / Product Designer', sector: 'Design', status: 'Closed' },
    { title: 'Staff Data Engineer', sector: 'Data', status: 'Active' },
    { title: 'Principal Security Architect', sector: 'Security', status: 'Active' },
    { title: 'AI / ML Platform Engineer', sector: 'Engineering', status: 'Active' },
  ]);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
