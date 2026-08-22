CREATE TYPE "RefundExecutionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "RefundConfirmationSource" AS ENUM ('MANUAL', 'PROVIDER');

CREATE TABLE "RefundExecution" (
    "id" TEXT NOT NULL,
    "refundEntitlementId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "status" "RefundExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "externalReference" VARCHAR(128),
    "clientRefundId" VARCHAR(128) NOT NULL,
    "destinationPhoneNumber" VARCHAR(20) NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "confirmationSource" "RefundConfirmationSource",
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    CONSTRAINT "RefundExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefundExecution_refundEntitlementId_clientRefundId_key" ON "RefundExecution"("refundEntitlementId", "clientRefundId");
CREATE INDEX "RefundExecution_refundEntitlementId_initiatedAt_id_idx" ON "RefundExecution"("refundEntitlementId", "initiatedAt", "id");
CREATE INDEX "RefundExecution_status_initiatedAt_idx" ON "RefundExecution"("status", "initiatedAt");
CREATE INDEX "RefundExecution_initiatedByUserId_initiatedAt_idx" ON "RefundExecution"("initiatedByUserId", "initiatedAt");
CREATE INDEX "RefundExecution_confirmedByUserId_confirmedAt_idx" ON "RefundExecution"("confirmedByUserId", "confirmedAt");
CREATE UNIQUE INDEX "RefundExecution_one_pending_per_entitlement_idx" ON "RefundExecution"("refundEntitlementId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "RefundExecution_one_completed_per_entitlement_idx" ON "RefundExecution"("refundEntitlementId") WHERE "status" = 'COMPLETED';
CREATE UNIQUE INDEX "RefundExecution_completed_provider_reference_idx" ON "RefundExecution"("provider", "externalReference") WHERE "status" = 'COMPLETED' AND "externalReference" IS NOT NULL;

ALTER TABLE "RefundExecution" ADD CONSTRAINT "RefundExecution_refundEntitlementId_fkey" FOREIGN KEY ("refundEntitlementId") REFERENCES "RefundEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundExecution" ADD CONSTRAINT "RefundExecution_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundExecution" ADD CONSTRAINT "RefundExecution_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
