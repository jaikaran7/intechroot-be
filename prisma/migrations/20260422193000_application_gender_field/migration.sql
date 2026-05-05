-- AlterTable: persist applicant gender captured during onboarding.
ALTER TABLE "applications"
  ADD COLUMN "gender" TEXT;
