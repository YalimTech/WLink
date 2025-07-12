-- DropForeignKey
ALTER TABLE "Instance" DROP CONSTRAINT "Instance_userId_fkey";

-- DropIndex
DROP INDEX "Instance_userId_key";

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN "name" VARCHAR(191);

-- CreateIndex
CREATE INDEX "Instance_userId_idx" ON "Instance"("userId");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
