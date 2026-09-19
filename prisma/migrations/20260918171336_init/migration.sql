/*
  Warnings:

  - The values [EXPIRED] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MAIN', 'TRAINING');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('GENERATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."ProductTask" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProductTask" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "ProductTask" ALTER COLUMN "status" SET DEFAULT 'GENERATED';
COMMIT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "commission" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ALTER COLUMN "commissionRate" SET DEFAULT 2.00;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "parentUserId" TEXT;

-- CreateIndex
CREATE INDEX "User_parentUserId_idx" ON "User"("parentUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
