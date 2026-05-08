-- AlterEnum: add hr_admin to UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'hr_admin';

-- AdminProfile.contact phone for HR admin (and future use)
ALTER TABLE "admin_profiles" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
