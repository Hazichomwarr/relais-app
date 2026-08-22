import { PrismaClient } from '@prisma/client';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import { QUICK_REFUND_POLICY, calculateQuickEntitlement, type QuickRefundReason } from '../../../constants/quick-refund-policy.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';

export const MAX_CANCELLATION_REASON_LENGTH = 1000;

export type CancelQuickMissionInput = { actor: AuthorizationSubject; missionId: string; reason?: string | null };
export type RefundEntitlementSummary = {
  id: string; missionId: string; paymentObligationId: string; cancellationId: string;
  originalAmount: number; refundRateBasisPoints: number; entitledAmount: number; currency: string;
  reason: QuickRefundReason; policyVersion: 'QUICK_V1'; createdAt: Date;
};
export type MissionCancellationSummary = { id: string; missionId: string; cancelledByUserId: string; reason: string | null; cancelledAt: Date };
export type CancelQuickMissionResult = { status: 'CANCELLED' | 'ALREADY_CANCELLED'; cancellation: MissionCancellationSummary; entitlement: RefundEntitlementSummary; mission: { id: string; lifecycle: 'CANCELLED'; cancelledAt: Date; executionStartedAt: Date | null } };
export type CancelQuickMissionErrorCode = 'INVALID_MISSION_ID' | 'INVALID_REASON' | 'REASON_TOO_LONG' | 'UNAUTHORIZED' | 'MISSION_NOT_FOUND' | 'CANCELLATION_NOT_ALLOWED' | 'PAYMENT_STATE_INCONSISTENT' | 'CANCELLATION_CONFLICT';
export class CancelQuickMissionError extends Error { readonly code: CancelQuickMissionErrorCode; constructor(code: CancelQuickMissionErrorCode, message: string) { super(message); this.name = 'CancelQuickMissionError'; this.code = code; } }

function validateReason(reason: string | null | undefined): string | null {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== 'string' || !reason.trim()) throw new CancelQuickMissionError('INVALID_REASON', 'Cancellation reason must contain text when provided.');
  if (reason.length > MAX_CANCELLATION_REASON_LENGTH) throw new CancelQuickMissionError('REASON_TOO_LONG', `Cancellation reason cannot exceed ${MAX_CANCELLATION_REASON_LENGTH} characters.`);
  return reason;
}

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error && (error.code === 'P2002' || error.code === 'P2034')) || /40001|serialization|deadlock|write conflict/i.test(message);
}

const cancellationSelect = { id: true, missionId: true, cancelledByUserId: true, reason: true, cancelledAt: true } as const;
const entitlementSelect = { id: true, missionId: true, paymentObligationId: true, cancellationId: true, originalAmount: true, refundRateBasisPoints: true, entitledAmount: true, currency: true, reason: true, policyVersion: true, createdAt: true } as const;

async function cancelOnce(input: CancelQuickMissionInput, client: PrismaClient): Promise<CancelQuickMissionResult> {
  return client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string; customerId: string; depth: string; lifecycle: string; executionStartedAt: Date | null; cancelledAt: Date | null }>>`
      SELECT mission."id", connection."customerId", mission."depth", mission."lifecycle", mission."executionStartedAt", mission."cancelledAt"
      FROM "Mission" mission INNER JOIN "Connection" connection ON connection."id" = mission."connectionId"
      WHERE mission."id" = ${input.missionId} FOR UPDATE OF mission`;
    const mission = rows[0];
    if (!mission) throw new CancelQuickMissionError('MISSION_NOT_FOUND', 'The Mission was not found.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    if (!canOperateAsCustomer(input.actor).allowed || !actor || actor.role !== 'CUSTOMER' || actor.accountStatus !== 'ACTIVE' || mission.customerId !== input.actor.userId) throw new CancelQuickMissionError('UNAUTHORIZED', 'Only the owning active Customer may cancel this Mission.');
    const existing = await transaction.missionCancellation.findUnique({ where: { missionId: mission.id }, include: { refundEntitlement: { select: entitlementSelect } } });
    if (existing) {
      if (!existing.refundEntitlement) throw new CancelQuickMissionError('PAYMENT_STATE_INCONSISTENT', 'The existing cancellation has no refund entitlement.');
      return { status: 'ALREADY_CANCELLED', cancellation: existing, entitlement: existing.refundEntitlement, mission: { id: mission.id, lifecycle: 'CANCELLED', cancelledAt: existing.cancelledAt, executionStartedAt: mission.executionStartedAt } };
    }
    if (mission.depth !== 'QUICK' || mission.lifecycle !== 'ACTIVE') throw new CancelQuickMissionError('CANCELLATION_NOT_ALLOWED', 'Only an ACTIVE QUICK Mission may be cancelled.');
    const pending = await transaction.completionAttempt.findFirst({ where: { missionId: mission.id, status: 'PENDING' }, select: { id: true } });
    if (pending) throw new CancelQuickMissionError('CANCELLATION_NOT_ALLOWED', 'Cancellation is not available once completion has been proposed.');
    const obligations = await transaction.paymentObligation.findMany({ where: { missionId: mission.id, purpose: 'RELAIS_FEE', status: 'PAID' }, select: { id: true, amount: true, currency: true } });
    if (obligations.length !== 1 || obligations[0].amount < 0) throw new CancelQuickMissionError('PAYMENT_STATE_INCONSISTENT', 'Exactly one paid QUICK fee obligation is required for cancellation.');
    const obligation = obligations[0];
    const refundReason: QuickRefundReason = mission.executionStartedAt ? 'AFTER_EXECUTION_STARTED' : 'BEFORE_EXECUTION_STARTED';
    const rateBasisPoints = QUICK_REFUND_POLICY[refundReason];
    const entitledAmount = calculateQuickEntitlement(obligation.amount, rateBasisPoints);
    const [{ now }] = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const cancellation = await transaction.missionCancellation.create({ data: { missionId: mission.id, cancelledByUserId: input.actor.userId, reason: validateReason(input.reason), cancelledAt: now }, select: cancellationSelect });
    const entitlement = await transaction.refundEntitlement.create({ data: { missionId: mission.id, paymentObligationId: obligation.id, cancellationId: cancellation.id, originalAmount: obligation.amount, refundRateBasisPoints: rateBasisPoints, entitledAmount, currency: obligation.currency, reason: refundReason, policyVersion: QUICK_REFUND_POLICY.POLICY_VERSION, createdAt: now }, select: entitlementSelect });
    await transaction.mission.update({ where: { id: mission.id }, data: { lifecycle: 'CANCELLED', cancelledAt: now } });
    await transaction.missionAssignment.updateMany({ where: { missionId: mission.id, endedAt: null }, data: { endedAt: now } });
    return { status: 'CANCELLED', cancellation, entitlement, mission: { id: mission.id, lifecycle: 'CANCELLED', cancelledAt: now, executionStartedAt: mission.executionStartedAt } };
  }, serializableTransactionOptions());
}

export async function cancelQuickMission(input: CancelQuickMissionInput, client: PrismaClient = prisma): Promise<CancelQuickMissionResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new CancelQuickMissionError('INVALID_MISSION_ID', 'A Mission id is required.');
  validateReason(input.reason);
  if (!canOperateAsCustomer(input.actor).allowed) throw new CancelQuickMissionError('UNAUTHORIZED', 'Only an active Customer may cancel a Mission.');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await cancelOnce(input, client); } catch (error) {
      if (isRetryable(error) && attempt < 2) continue;
      if (isRetryable(error)) throw new CancelQuickMissionError('CANCELLATION_CONFLICT', 'Mission cancellation could not complete safely.');
      throw error;
    }
  }
  throw new CancelQuickMissionError('CANCELLATION_CONFLICT', 'Mission cancellation could not complete safely.');
}
