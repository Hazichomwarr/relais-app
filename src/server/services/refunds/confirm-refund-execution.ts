import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import { assertActiveAdmin, executionSelect, isRetryableRefundConflict, toExecutionSummary, validateExternalReference, verifyActiveAdmin, type RefundExecutionSummary } from './refund-workflow.ts';

export type ConfirmRefundExecutionInput = { actor: AuthorizationSubject; refundExecutionId: string; externalReference: string };
export type ConfirmRefundExecutionResult = { status: 'COMPLETED' | 'ALREADY_COMPLETED'; execution: RefundExecutionSummary };
export type ConfirmRefundExecutionErrorCode = 'INVALID_REFUND_EXECUTION_ID' | 'INVALID_EXTERNAL_REFERENCE' | 'UNAUTHORIZED' | 'REFUND_EXECUTION_NOT_FOUND' | 'INVALID_REFUND_EXECUTION_STATE' | 'CONFIRMATION_CONFLICT' | 'EXTERNAL_REFERENCE_CONFLICT' | 'REFUND_NOT_EXECUTABLE';
export class ConfirmRefundExecutionError extends Error { readonly code: ConfirmRefundExecutionErrorCode; constructor(code: ConfirmRefundExecutionErrorCode, message: string) { super(message); this.name = 'ConfirmRefundExecutionError'; this.code = code; } }

async function confirmOnce(input: ConfirmRefundExecutionInput, reference: string, client: PrismaClient): Promise<ConfirmRefundExecutionResult> {
  return client.$transaction(async (transaction) => {
    await verifyActiveAdmin(transaction, input.actor);
    const execution = await transaction.refundExecution.findUnique({ where: { id: input.refundExecutionId }, select: { ...executionSelect, refundEntitlement: { select: { entitledAmount: true, mission: { select: { lifecycle: true } }, paymentObligation: { select: { status: true } } } } } });
    if (!execution) throw new ConfirmRefundExecutionError('REFUND_EXECUTION_NOT_FOUND', 'The Refund Execution was not found.');
    if (execution.status === 'COMPLETED') { if (execution.externalReference === reference) return { status: 'ALREADY_COMPLETED', execution: toExecutionSummary(execution) }; throw new ConfirmRefundExecutionError('CONFIRMATION_CONFLICT', 'Completed refund evidence cannot be rewritten.'); }
    if (execution.status !== 'PENDING') throw new ConfirmRefundExecutionError('INVALID_REFUND_EXECUTION_STATE', 'Only a pending refund execution may be confirmed.');
    if (execution.refundEntitlement.entitledAmount <= 0 || execution.refundEntitlement.mission.lifecycle !== 'CANCELLED' || execution.refundEntitlement.paymentObligation.status !== 'PAID') throw new ConfirmRefundExecutionError('REFUND_NOT_EXECUTABLE', 'The source refund entitlement is no longer executable.');
    const [{ now }] = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const updated = await transaction.refundExecution.update({ where: { id: execution.id }, data: { status: 'COMPLETED', externalReference: reference, confirmedByUserId: input.actor.userId, confirmationSource: 'MANUAL', confirmedAt: now }, select: executionSelect });
    return { status: 'COMPLETED', execution: toExecutionSummary(updated) };
  }, serializableTransactionOptions());
}

export async function confirmRefundExecution(input: ConfirmRefundExecutionInput, client: PrismaClient = prisma): Promise<ConfirmRefundExecutionResult> {
  if (typeof input.refundExecutionId !== 'string' || !input.refundExecutionId.trim()) throw new ConfirmRefundExecutionError('INVALID_REFUND_EXECUTION_ID', 'A refund execution id is required.');
  try { assertActiveAdmin(input.actor); } catch { throw new ConfirmRefundExecutionError('UNAUTHORIZED', 'Only an active Admin may confirm refunds.'); }
  let reference: string; try { reference = validateExternalReference(input.externalReference); } catch { throw new ConfirmRefundExecutionError('INVALID_EXTERNAL_REFERENCE', 'A transaction reference is required.'); }
  for (let attempt = 0; attempt < 3; attempt += 1) { try { return await confirmOnce(input, reference!, client); } catch (error) { if (isRetryableRefundConflict(error) && attempt < 2) continue; if (isRetryableRefundConflict(error)) throw new ConfirmRefundExecutionError('CONFIRMATION_CONFLICT', 'Refund confirmation could not complete safely.'); if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') throw new ConfirmRefundExecutionError('EXTERNAL_REFERENCE_CONFLICT', 'This provider reference was already used.'); throw error; } }
  throw new ConfirmRefundExecutionError('CONFIRMATION_CONFLICT', 'Refund confirmation could not complete safely.');
}
