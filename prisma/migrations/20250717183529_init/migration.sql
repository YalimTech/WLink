-- CreateEnum
CREATE TYPE "InstanceState" AS ENUM ('notAuthorized', 'authorized', 'yellowCard', 'blocked', 'starting');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "companyId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" BIGSERIAL NOT NULL,
    "idInstance" TEXT NOT NULL,
    "name" TEXT,
    "apiTokenInstance" TEXT NOT NULL,
    "stateInstance" "InstanceState",
    "userId" UUID NOT NULL,
    "settings" JSON DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_idInstance_key" ON "Instance"("idInstance");

-- CreateIndex
CREATE INDEX "Instance_userId_idx" ON "Instance"("userId");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
