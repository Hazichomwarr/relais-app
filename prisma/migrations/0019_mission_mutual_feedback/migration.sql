CREATE TYPE "MissionFeedbackDirection" AS ENUM ('CUSTOMER_TO_RELAIS', 'RELAIS_TO_CUSTOMER');

CREATE TABLE "MissionFeedback" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "direction" "MissionFeedbackDirection" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "clientFeedbackId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MissionFeedback_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "MissionFeedback_missionId_direction_key" ON "MissionFeedback"("missionId", "direction");
CREATE UNIQUE INDEX "MissionFeedback_missionId_authorUserId_clientFeedbackId_key" ON "MissionFeedback"("missionId", "authorUserId", "clientFeedbackId");
CREATE INDEX "MissionFeedback_authorUserId_createdAt_idx" ON "MissionFeedback"("authorUserId", "createdAt");
CREATE INDEX "MissionFeedback_subjectUserId_createdAt_idx" ON "MissionFeedback"("subjectUserId", "createdAt");
CREATE INDEX "MissionFeedback_missionId_createdAt_id_idx" ON "MissionFeedback"("missionId", "createdAt", "id");

ALTER TABLE "MissionFeedback" ADD CONSTRAINT "MissionFeedback_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionFeedback" ADD CONSTRAINT "MissionFeedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionFeedback" ADD CONSTRAINT "MissionFeedback_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
