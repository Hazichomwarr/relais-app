import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import { assertActiveAdmin, executionSelect, isRetryableRefundConflict, toExecutionSummary, validateFailureReason, verifyActiveAdmin, type RefundExecutionSummary } from './refund-workflow.ts';

export type FailRefundExecutionInput = { actor: AuthorizationSubject; refundExecutionId: string; reason?: string | null };
export type FailRefundExecutionResult = { status: 'FAILED'; execution: RefundExecutionSummary };
export type FailRefundExecutionErrorCode = 'INVALID_REFUND_EXECUTION_ID' | 'INVALID_FAILURE_REASON' | 'FAILURE_REASON_TOO_LONG' | 'UNAUTHORIZED' | 'REFUND_EXECUTION_NOT_FOUND' | 'INVALID_REFUND_EXECUTION_STATE' | 'REFUND_EXECUTION_CONFLICT';
export class FailRefundExecutionError extends Error { readonly code: FailRefundExecutionErrorCode; constructor(code: FailRefundExecutionErrorCode, message: string) { super(message); this.name = 'FailRefundExecutionError'; this.code = code; } }

export async function failRefundExecution(input: FailRefundExecutionInput, client: PrismaClient = prisma): Promise<FailRefundExecutionResult> {
  if (typeof input.refundExecutionId !== 'string' || !input.refundExecutionId.trim()) throw new FailRefundExecutionError('INVALID_REFUND_EXECUTION_ID', 'A refund execution id is required.');
  try { assertActiveAdmin(input.actor); } catch { throw new FailRefundExecutionError('UNAUTHORIZED', 'Only an active Admin may fail refunds.'); }
  let reason: string | null; try { reason = validateFailureReason(input.reason); } catch (error) { const code = error instanceof Error ? error.message : 'INVALID_FAILURE_REASON'; throw new FailRefundExecutionError(code as FailRefundExecutionErrorCode, code === 'FAILURE_REASON_TOO_LONG' ? 'Failure reason is too long.' : 'Failure reason must contain text when provided.'); }
  for (let attempt = 0; attempt < 3; attempt += 1) { try { return await client.$transaction(async (transaction) => { await verifyActiveAdmin(transaction, input.actor); const execution = await transaction.refundExecution.findUnique({ where: { id: input.refundExecutionId }, select: executionSelect }); if (!execution) throw new FailRefundExecutionError('REFUND_EXECUTION_NOT_FOUND', 'The Refund Execution was not found.'); if (execution.status !== 'PENDING') throw new FailRefundExecutionError('INVALID_REFUND_EXECUTION_STATE', 'Only a pending refund execution may be failed.'); const [{ now }] = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`; const updated = await transaction.refundExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', failedAt: now, failureReason: reason }, select: executionSelect }); return { status: 'FAILED', execution: toExecutionSummary(updated) }; }, serializableTransactionOptions()); } catch (error) { if (isRetryableRefundConflict(error) && attempt < 2) continue; if (isRetryableRefundConflict(error)) throw new FailRefundExecutionError('REFUND_EXECUTION_CONFLICT', 'Refund failure could not complete safely.'); throw error; } }
  throw new FailRefundExecutionError('REFUND_EXECUTION_CONFLICT', 'Refund failure could not complete safely.');
}
