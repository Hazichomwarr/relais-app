CREATE TYPE "CompletionAttemptStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED');

CREATE TABLE "CompletionAttempt" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "CompletionAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "clientCompletionId" VARCHAR(128) NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "responseByUserId" TEXT,
    "problemNote" TEXT,

    CONSTRAINT "CompletionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompletionAttempt_missionId_proposedByUserId_clientCompletionId_key"
ON "CompletionAttempt"("missionId", "proposedByUserId", "clientCompletionId");

CREATE INDEX "CompletionAttempt_missionId_proposedAt_id_idx"
ON "CompletionAttempt"("missionId", "proposedAt", "id");

CREATE INDEX "CompletionAttempt_status_missionId_idx"
ON "CompletionAttempt"("status", "missionId");

CREATE UNIQUE INDEX "CompletionAttempt_one_pending_per_mission_idx"
ON "CompletionAttempt"("missionId") WHERE "status" = 'PENDING';

ALTER TABLE "CompletionAttempt" ADD CONSTRAINT "CompletionAttempt_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompletionAttempt" ADD CONSTRAINT "CompletionAttempt_proposedByUserId_fkey"
FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompletionAttempt" ADD CONSTRAINT "CompletionAttempt_responseByUserId_fkey"
FOREIGN KEY ("responseByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
