CREATE TYPE "MissionDepth" AS ENUM ('QUICK', 'MANAGED');
CREATE TYPE "MissionUrgency" AS ENUM ('NORMAL', 'URGENT');
CREATE TYPE "MissionLifecycle" AS ENUM ('PENDING_EXECUTION', 'ACTIVE', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "depth" "MissionDepth" NOT NULL,
    "urgency" "MissionUrgency" NOT NULL DEFAULT 'NORMAL',
    "lifecycle" "MissionLifecycle" NOT NULL DEFAULT 'PENDING_EXECUTION',
    "acceptedQuickOfferId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionAssignment" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "relaisUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "assignedByUserId" TEXT,
    CONSTRAINT "MissionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Mission_connectionId_key" ON "Mission"("connectionId");
CREATE UNIQUE INDEX "Mission_acceptedQuickOfferId_key" ON "Mission"("acceptedQuickOfferId");
CREATE INDEX "MissionAssignment_missionId_assignedAt_idx" ON "MissionAssignment"("missionId", "assignedAt");
CREATE INDEX "MissionAssignment_relaisUserId_assignedAt_idx" ON "MissionAssignment"("relaisUserId", "assignedAt");
CREATE INDEX "MissionAssignment_assignedByUserId_idx" ON "MissionAssignment"("assignedByUserId");
CREATE UNIQUE INDEX "MissionAssignment_one_active_per_mission"
ON "MissionAssignment" ("missionId")
WHERE "endedAt" IS NULL;

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "Connection"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_acceptedQuickOfferId_fkey"
FOREIGN KEY ("acceptedQuickOfferId") REFERENCES "QuickOffer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionAssignment"
ADD CONSTRAINT "MissionAssignment_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionAssignment"
ADD CONSTRAINT "MissionAssignment_relaisUserId_fkey"
FOREIGN KEY ("relaisUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionAssignment"
ADD CONSTRAINT "MissionAssignment_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
