CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CASH', 'MANUAL_TRANSFER');
CREATE TYPE "PaymentConfirmationSource" AS ENUM ('PROVIDER', 'MANUAL');

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentObligationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "externalReference" VARCHAR(128),
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "clientAttemptId" VARCHAR(128) NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(64),
    "confirmationSource" "PaymentConfirmationSource",
    "confirmedByUserId" TEXT,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_paymentObligationId_clientAttemptId_key"
ON "PaymentAttempt"("paymentObligationId", "clientAttemptId");

CREATE UNIQUE INDEX "PaymentAttempt_provider_externalReference_key"
ON "PaymentAttempt"("provider", "externalReference");

CREATE UNIQUE INDEX "PaymentAttempt_one_active_per_obligation_idx"
ON "PaymentAttempt"("paymentObligationId")
WHERE "status" IN ('INITIATED', 'PENDING');

CREATE INDEX "PaymentAttempt_paymentObligationId_status_initiatedAt_id_idx"
ON "PaymentAttempt"("paymentObligationId", "status", "initiatedAt", "id");

CREATE INDEX "PaymentAttempt_confirmedByUserId_idx"
ON "PaymentAttempt"("confirmedByUserId");

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_paymentObligationId_fkey"
FOREIGN KEY ("paymentObligationId") REFERENCES "PaymentObligation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_confirmedByUserId_fkey"
FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_amount_positive_check"
CHECK ("amount" > 0);
