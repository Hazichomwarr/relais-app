-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'RELAIS', 'ADMIN');
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "RelaisEligibility" AS ENUM ('APPROVED', 'UNDER_REVIEW', 'REVOKED');
CREATE TYPE "RelaisAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "ConnectionLifecycle" AS ENUM ('MATCHING', 'CONNECTED', 'ENDED');
CREATE TYPE "ConnectionTerminalOutcome" AS ENUM ('MISSION_CREATED', 'CUSTOMER_CANCELLED', 'DECLINED', 'NO_RELAIS_AVAILABLE', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredLanguage" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelaisProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eligibility" "RelaisEligibility" NOT NULL DEFAULT 'UNDER_REVIEW',
    "availability" "RelaisAvailability" NOT NULL DEFAULT 'UNAVAILABLE',
    "availabilityChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RelaisProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lifecycle" "ConnectionLifecycle" NOT NULL DEFAULT 'MATCHING',
    "terminalOutcome" "ConnectionTerminalOutcome",
    "preferredLanguage" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConnectionAssignment" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "relaisUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "assignedByUserId" TEXT,
    CONSTRAINT "ConnectionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");
CREATE UNIQUE INDEX "RelaisProfile_userId_key" ON "RelaisProfile"("userId");
CREATE INDEX "RelaisProfile_eligibility_availability_idx" ON "RelaisProfile"("eligibility", "availability");
CREATE INDEX "Connection_customerId_lifecycle_idx" ON "Connection"("customerId", "lifecycle");
CREATE INDEX "ConnectionAssignment_connectionId_assignedAt_idx" ON "ConnectionAssignment"("connectionId", "assignedAt");
CREATE INDEX "ConnectionAssignment_relaisUserId_assignedAt_idx" ON "ConnectionAssignment"("relaisUserId", "assignedAt");
CREATE INDEX "ConnectionAssignment_assignedByUserId_idx" ON "ConnectionAssignment"("assignedByUserId");
CREATE UNIQUE INDEX "Conversation_connectionId_key" ON "Conversation"("connectionId");

-- PostgreSQL partial uniqueness enforces at most one active assignment per connection.
CREATE UNIQUE INDEX "ConnectionAssignment_one_active_per_connection"
ON "ConnectionAssignment" ("connectionId")
WHERE "endedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RelaisProfile" ADD CONSTRAINT "RelaisProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectionAssignment" ADD CONSTRAINT "ConnectionAssignment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectionAssignment" ADD CONSTRAINT "ConnectionAssignment_relaisUserId_fkey" FOREIGN KEY ("relaisUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectionAssignment" ADD CONSTRAINT "ConnectionAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
