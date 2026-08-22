CREATE TYPE "ManagedProposalStatus" AS ENUM ('DRAFT', 'SENT', 'SUPERSEDED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "ManagedProposal" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "relaisUserId" TEXT NOT NULL,
    "status" "ManagedProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT NOT NULL,
    "estimatedDurationText" VARCHAR(100),
    "serviceAmount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "clientProposalId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedProposal_conversationId_version_key" ON "ManagedProposal"("conversationId", "version");
CREATE UNIQUE INDEX "ManagedProposal_conversationId_relaisUserId_clientProposalId_key" ON "ManagedProposal"("conversationId", "relaisUserId", "clientProposalId");
CREATE INDEX "ManagedProposal_connectionId_createdAt_id_idx" ON "ManagedProposal"("connectionId", "createdAt", "id");
CREATE INDEX "ManagedProposal_customerUserId_createdAt_idx" ON "ManagedProposal"("customerUserId", "createdAt");
CREATE INDEX "ManagedProposal_relaisUserId_createdAt_idx" ON "ManagedProposal"("relaisUserId", "createdAt");
CREATE UNIQUE INDEX "ManagedProposal_one_draft_per_conversation_idx" ON "ManagedProposal"("conversationId") WHERE "status" = 'DRAFT';

ALTER TABLE "ManagedProposal" ADD CONSTRAINT "ManagedProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedProposal" ADD CONSTRAINT "ManagedProposal_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedProposal" ADD CONSTRAINT "ManagedProposal_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedProposal" ADD CONSTRAINT "ManagedProposal_relaisUserId_fkey" FOREIGN KEY ("relaisUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
