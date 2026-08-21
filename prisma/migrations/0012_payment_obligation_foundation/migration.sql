CREATE TYPE "PaymentObligationPurpose" AS ENUM ('RELAIS_FEE', 'MISSION_FUNDS');
CREATE TYPE "PaymentObligationStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

CREATE TABLE "PaymentObligation" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "purpose" "PaymentObligationPurpose" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentObligationStatus" NOT NULL DEFAULT 'PENDING',
    "sourceQuickOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "PaymentObligation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentObligation_sourceQuickOfferId_key"
ON "PaymentObligation"("sourceQuickOfferId");

CREATE INDEX "PaymentObligation_missionId_createdAt_id_idx"
ON "PaymentObligation"("missionId", "createdAt", "id");

CREATE INDEX "PaymentObligation_status_createdAt_idx"
ON "PaymentObligation"("status", "createdAt");

ALTER TABLE "PaymentObligation"
ADD CONSTRAINT "PaymentObligation_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentObligation"
ADD CONSTRAINT "PaymentObligation_sourceQuickOfferId_fkey"
FOREIGN KEY ("sourceQuickOfferId") REFERENCES "QuickOffer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
