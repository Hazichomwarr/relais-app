ALTER TYPE "MessageType"
ADD VALUE 'VOICE';

ALTER TABLE "Message"
ALTER COLUMN "text" DROP NOT NULL;

CREATE TABLE "VoiceMessageAsset" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceMessageAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceMessageAsset_messageId_key"
ON "VoiceMessageAsset" ("messageId");

CREATE UNIQUE INDEX "VoiceMessageAsset_storageKey_key"
ON "VoiceMessageAsset" ("storageKey");

ALTER TABLE "VoiceMessageAsset"
ADD CONSTRAINT "VoiceMessageAsset_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
