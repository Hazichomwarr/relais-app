CREATE TYPE "QuickRefundEntitlementReason" AS ENUM ('BEFORE_EXECUTION_STARTED', 'AFTER_EXECUTION_STARTED');
CREATE TYPE "QuickRefundPolicyVersion" AS ENUM ('QUICK_V1');

CREATE TABLE "MissionCancellation" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "cancelledByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionCancellation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundEntitlement" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "paymentObligationId" TEXT NOT NULL,
    "cancellationId" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "refundRateBasisPoints" INTEGER NOT NULL,
    "entitledAmount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" "QuickRefundEntitlementReason" NOT NULL,
    "policyVersion" "QuickRefundPolicyVersion" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionCancellation_missionId_key" ON "MissionCancellation"("missionId");
CREATE INDEX "MissionCancellation_cancelledByUserId_cancelledAt_idx" ON "MissionCancellation"("cancelledByUserId", "cancelledAt");
CREATE UNIQUE INDEX "RefundEntitlement_missionId_key" ON "RefundEntitlement"("missionId");
CREATE UNIQUE INDEX "RefundEntitlement_paymentObligationId_key" ON "RefundEntitlement"("paymentObligationId");
CREATE UNIQUE INDEX "RefundEntitlement_cancellationId_key" ON "RefundEntitlement"("cancellationId");
CREATE INDEX "RefundEntitlement_reason_createdAt_idx" ON "RefundEntitlement"("reason", "createdAt");

ALTER TABLE "MissionCancellation" ADD CONSTRAINT "MissionCancellation_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionCancellation" ADD CONSTRAINT "MissionCancellation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundEntitlement" ADD CONSTRAINT "RefundEntitlement_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundEntitlement" ADD CONSTRAINT "RefundEntitlement_paymentObligationId_fkey" FOREIGN KEY ("paymentObligationId") REFERENCES "PaymentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundEntitlement" ADD CONSTRAINT "RefundEntitlement_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "MissionCancellation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
