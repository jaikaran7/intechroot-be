-- AlterTable: add applicant personal identity fields captured during onboarding profile step.
ALTER TABLE "applications"
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "nationality" TEXT,
  ADD COLUMN "profilePhotoUrl" TEXT,
  ADD COLUMN "profilePhotoName" TEXT;
