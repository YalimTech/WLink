-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(191) NOT NULL,
    "companyId" VARCHAR(191),
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "InstanceState" AS ENUM ('notAuthorized', 'authorized', 'yellowCard', 'blocked', 'starting');

-- CreateTable
CREATE TABLE "Instance" (
    "id" BIGSERIAL NOT NULL,
    "idInstance" BIGINT NOT NULL,
    "apiTokenInstance" VARCHAR(191) NOT NULL,
    "stateInstance" "InstanceState",
    "userId" VARCHAR(191) NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_idInstance_key" ON "Instance"("idInstance");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_userId_key" ON "Instance"("userId");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
