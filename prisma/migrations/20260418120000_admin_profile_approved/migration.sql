-- Admin must explicitly approve profile review before document step in admin UI.
ALTER TABLE "onboarding_states" ADD COLUMN IF NOT EXISTS "adminProfileApproved" BOOLEAN NOT NULL DEFAULT false;
-- Preserve behavior for onboardings where the applicant already finished their profile.
UPDATE "onboarding_states" SET "adminProfileApproved" = true WHERE "profileCompleted" = true;
