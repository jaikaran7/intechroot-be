ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

CREATE TABLE IF NOT EXISTS "employee_assignments" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_assignments_adminUserId_employeeId_key"
  ON "employee_assignments"("adminUserId", "employeeId");

CREATE INDEX IF NOT EXISTS "employee_assignments_adminUserId_isActive_idx"
  ON "employee_assignments"("adminUserId", "isActive");

CREATE INDEX IF NOT EXISTS "employee_assignments_employeeId_isActive_idx"
  ON "employee_assignments"("employeeId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employee_assignments_adminUserId_fkey'
  ) THEN
    ALTER TABLE "employee_assignments"
      ADD CONSTRAINT "employee_assignments_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employee_assignments_employeeId_fkey'
  ) THEN
    ALTER TABLE "employee_assignments"
      ADD CONSTRAINT "employee_assignments_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_profiles" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "company" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'Active',
  "permissions" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_profiles_adminUserId_key"
  ON "admin_profiles"("adminUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_profiles_adminUserId_fkey'
  ) THEN
    ALTER TABLE "admin_profiles"
      ADD CONSTRAINT "admin_profiles_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
