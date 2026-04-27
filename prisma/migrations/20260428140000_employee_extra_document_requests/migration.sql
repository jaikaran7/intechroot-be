-- Employee-scoped extra document rows (no application required)
CREATE TABLE "employee_extra_document_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_extra_document_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_extra_document_requests_employeeId_idx" ON "employee_extra_document_requests"("employeeId");

ALTER TABLE "employee_extra_document_requests" ADD CONSTRAINT "employee_extra_document_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
