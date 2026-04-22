-- Align DB with Interview.link / Interview.notes (init migration predated these columns).
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "notes" TEXT;
