CREATE TABLE "CallAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetPhoneNumber" VARCHAR(20) NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallAction_conversationId_initiatedAt_id_idx"
ON "CallAction" ("conversationId", "initiatedAt", "id");

CREATE INDEX "CallAction_initiatedByUserId_initiatedAt_idx"
ON "CallAction" ("initiatedByUserId", "initiatedAt");

CREATE INDEX "CallAction_targetUserId_initiatedAt_idx"
ON "CallAction" ("targetUserId", "initiatedAt");

ALTER TABLE "CallAction"
ADD CONSTRAINT "CallAction_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallAction"
ADD CONSTRAINT "CallAction_initiatedByUserId_fkey"
FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallAction"
ADD CONSTRAINT "CallAction_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
