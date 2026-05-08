-- EmployeeAssignment (admin ↔ employee); no FKs in schema — matches prisma EmployeeAssignment
CREATE TABLE IF NOT EXISTS "employee_assignments" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_assignments_adminUserId_employeeId_key" ON "employee_assignments"("adminUserId", "employeeId");
CREATE INDEX IF NOT EXISTS "employee_assignments_adminUserId_isActive_idx" ON "employee_assignments"("adminUserId", "isActive");
CREATE INDEX IF NOT EXISTS "employee_assignments_employeeId_isActive_idx" ON "employee_assignments"("employeeId", "isActive");
