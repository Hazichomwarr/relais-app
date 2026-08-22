CREATE TYPE "MissionUpdateType" AS ENUM ('PROGRESS', 'NOTE');

CREATE TABLE "MissionUpdate" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "MissionUpdateType" NOT NULL,
    "text" TEXT NOT NULL,
    "clientUpdateId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionUpdate_missionId_authorUserId_clientUpdateId_key"
ON "MissionUpdate"("missionId", "authorUserId", "clientUpdateId");

CREATE INDEX "MissionUpdate_missionId_createdAt_id_idx"
ON "MissionUpdate"("missionId", "createdAt", "id");

CREATE INDEX "MissionUpdate_authorUserId_createdAt_idx"
ON "MissionUpdate"("authorUserId", "createdAt");

ALTER TABLE "MissionUpdate"
ADD CONSTRAINT "MissionUpdate_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionUpdate"
ADD CONSTRAINT "MissionUpdate_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
