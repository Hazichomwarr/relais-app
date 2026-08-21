CREATE TYPE "MessageType" AS ENUM ('TEXT');

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT NOT NULL,
    "clientMessageId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Message_conversationId_senderUserId_clientMessageId_key"
ON "Message" ("conversationId", "senderUserId", "clientMessageId");

CREATE INDEX "Message_conversationId_createdAt_id_idx"
ON "Message" ("conversationId", "createdAt", "id");

CREATE INDEX "Message_senderUserId_createdAt_idx"
ON "Message" ("senderUserId", "createdAt");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
