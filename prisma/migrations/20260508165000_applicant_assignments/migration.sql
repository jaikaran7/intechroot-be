CREATE TABLE IF NOT EXISTS "applicant_assignments" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "applicant_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "applicant_assignments_adminUserId_applicationId_key"
ON "applicant_assignments"("adminUserId", "applicationId");

CREATE INDEX IF NOT EXISTS "applicant_assignments_adminUserId_isActive_idx"
ON "applicant_assignments"("adminUserId", "isActive");

CREATE INDEX IF NOT EXISTS "applicant_assignments_applicationId_isActive_idx"
ON "applicant_assignments"("applicationId", "isActive");
