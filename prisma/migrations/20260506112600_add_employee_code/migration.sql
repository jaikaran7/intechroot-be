-- Add human-friendly employee code (INTR-YY-0001)
ALTER TABLE "employees"
ADD COLUMN "employeeCode" TEXT;

-- Unique constraint (allows multiple NULLs)
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

