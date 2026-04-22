-- AlterTable
ALTER TABLE "applications" ADD COLUMN "portalApprovedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "applicantApplicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_applicantApplicationId_key" ON "users"("applicantApplicationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_applicantApplicationId_fkey" FOREIGN KEY ("applicantApplicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
