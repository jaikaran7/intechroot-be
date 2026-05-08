-- Add dedicated onboarding application ID and year-scoped sequence table.
ALTER TABLE "applications"
ADD COLUMN "onboardingApplicationId" TEXT;

CREATE TABLE "onboarding_application_sequences" (
  "year" INTEGER NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_application_sequences_pkey" PRIMARY KEY ("year")
);

CREATE UNIQUE INDEX "applications_onboardingApplicationId_key"
ON "applications"("onboardingApplicationId");
