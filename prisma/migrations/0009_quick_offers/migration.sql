CREATE TYPE "QuickOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CANCELLED');

CREATE TABLE "QuickOffer" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "createdByRelaisUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "QuickOfferStatus" NOT NULL DEFAULT 'PENDING',
    "clientOfferId" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "QuickOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuickOffer_connectionId_createdByRelaisUserId_clientOfferId_key"
ON "QuickOffer" ("connectionId", "createdByRelaisUserId", "clientOfferId");

CREATE INDEX "QuickOffer_connectionId_createdAt_id_idx"
ON "QuickOffer" ("connectionId", "createdAt", "id");

CREATE INDEX "QuickOffer_createdByRelaisUserId_createdAt_idx"
ON "QuickOffer" ("createdByRelaisUserId", "createdAt");

CREATE UNIQUE INDEX "QuickOffer_one_pending_per_connection"
ON "QuickOffer" ("connectionId")
WHERE "status" = 'PENDING';

ALTER TABLE "QuickOffer"
ADD CONSTRAINT "QuickOffer_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "Connection"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuickOffer"
ADD CONSTRAINT "QuickOffer_createdByRelaisUserId_fkey"
FOREIGN KEY ("createdByRelaisUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
