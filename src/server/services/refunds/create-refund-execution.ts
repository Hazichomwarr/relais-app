import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import { assertActiveAdmin, executionSelect, isRetryableRefundConflict, isVerifiedPhone, toExecutionSummary, validateClientRefundId, validateProvider, verifyActiveAdmin, type RefundExecutionSummary } from './refund-workflow.ts';

export type CreateRefundExecutionInput = { actor: AuthorizationSubject; refundEntitlementId: string; method: 'MOBILE_MONEY'; provider: string; clientRefundId: string };
export type CreateRefundExecutionResult = { status: 'CREATED' | 'EXISTING'; execution: RefundExecutionSummary };
export type CreateRefundExecutionErrorCode = 'INVALID_REFUND_ENTITLEMENT_ID' | 'INVALID_METHOD' | 'INVALID_PROVIDER' | 'PROVIDER_TOO_LONG' | 'INVALID_CLIENT_REFUND_ID' | 'UNAUTHORIZED' | 'REFUND_ENTITLEMENT_NOT_FOUND' | 'REFUND_NOT_EXECUTABLE' | 'REFUND_DESTINATION_UNAVAILABLE' | 'ACTIVE_REFUND_EXECUTION_EXISTS' | 'REFUND_ALREADY_COMPLETED' | 'IDEMPOTENCY_CONFLICT' | 'REFUND_EXECUTION_CONFLICT';
export class CreateRefundExecutionError extends Error { readonly code: CreateRefundExecutionErrorCode; constructor(code: CreateRefundExecutionErrorCode, message: string) { super(message); this.name = 'CreateRefundExecutionError'; this.code = code; } }

function mapInput(error: unknown): never { const code = error instanceof Error ? error.message : 'INVALID_PROVIDER'; const messages: Record<string, string> = { INVALID_METHOD: 'Only MOBILE_MONEY is supported for manual refunds.', INVALID_PROVIDER: 'A refund provider is required.', PROVIDER_TOO_LONG: 'The refund provider is too long.', INVALID_CLIENT_REFUND_ID: 'A valid client refund id is required.' }; throw new CreateRefundExecutionError((code in messages ? code : 'INVALID_PROVIDER') as CreateRefundExecutionErrorErrorCode, messages[code] ?? 'Refund input is invalid.'); }
type CreateRefundExecutionErrorErrorCode = CreateRefundExecutionErrorCode;

async function createOnce(input: CreateRefundExecutionInput, provider: string, clientRefundId: string, client: PrismaClient): Promise<CreateRefundExecutionResult> {
  return client.$transaction(async (transaction) => {
    await verifyActiveAdmin(transaction, input.actor);
    const entitlement = await transaction.refundEntitlement.findUnique({ where: { id: input.refundEntitlementId }, select: { id: true, entitledAmount: true, currency: true, mission: { select: { id: true, lifecycle: true, connection: { select: { customerId: true } } } }, paymentObligation: { select: { status: true } } } });
    if (!entitlement) throw new CreateRefundExecutionError('REFUND_ENTITLEMENT_NOT_FOUND', 'The Refund Entitlement was not found.');
    const existing = await transaction.refundExecution.findUnique({ where: { refundEntitlementId_clientRefundId: { refundEntitlementId: entitlement.id, clientRefundId } }, select: executionSelect });
    if (existing) {
      if (existing.method !== input.method || existing.provider !== provider) throw new CreateRefundExecutionError('IDEMPOTENCY_CONFLICT', 'The client refund id was already used with different intent.');
      return { status: 'EXISTING', execution: toExecutionSummary(existing) };
    }
    if (entitlement.entitledAmount <= 0 || entitlement.mission.lifecycle !== 'CANCELLED' || entitlement.paymentObligation.status !== 'PAID') throw new CreateRefundExecutionError('REFUND_NOT_EXECUTABLE', 'Only a positive entitlement for a cancelled Mission with paid source history is executable.');
    const completed = await transaction.refundExecution.findFirst({ where: { refundEntitlementId: entitlement.id, status: 'COMPLETED' }, select: { id: true } });
    if (completed) throw new CreateRefundExecutionError('REFUND_ALREADY_COMPLETED', 'This entitlement has already been refunded.');
    const pending = await transaction.refundExecution.findFirst({ where: { refundEntitlementId: entitlement.id, status: 'PENDING' }, select: { id: true } });
    if (pending) throw new CreateRefundExecutionError('ACTIVE_REFUND_EXECUTION_EXISTS', 'A refund execution is already pending for this entitlement.');
    const customer = await transaction.user.findUnique({ where: { id: entitlement.mission.connection.customerId }, select: { phoneNumber: true, phoneVerifiedAt: true } });
    if (!customer || !isVerifiedPhone(customer.phoneNumber, customer.phoneVerifiedAt)) throw new CreateRefundExecutionError('REFUND_DESTINATION_UNAVAILABLE', 'The Customer has no verified Mobile Money destination.');
    const [{ now }] = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const execution = await transaction.refundExecution.create({ data: { refundEntitlementId: entitlement.id, amount: entitlement.entitledAmount, currency: entitlement.currency, method: input.method, provider, clientRefundId, destinationPhoneNumber: customer.phoneNumber, initiatedByUserId: input.actor.userId, initiatedAt: now }, select: executionSelect });
    return { status: 'CREATED', execution: toExecutionSummary(execution) };
  }, serializableTransactionOptions());
}

export async function createRefundExecution(input: CreateRefundExecutionInput, client: PrismaClient = prisma): Promise<CreateRefundExecutionResult> {
  if (typeof input.refundEntitlementId !== 'string' || !input.refundEntitlementId.trim()) throw new CreateRefundExecutionError('INVALID_REFUND_ENTITLEMENT_ID', 'A refund entitlement id is required.');
  try { assertActiveAdmin(input.actor); } catch { throw new CreateRefundExecutionError('UNAUTHORIZED', 'Only an active Admin may initiate refunds.'); }
  if (input.method !== 'MOBILE_MONEY') throw new CreateRefundExecutionError('INVALID_METHOD', 'Only MOBILE_MONEY is supported for manual refunds.');
  let provider: string; let clientRefundId: string;
  try { provider = validateProvider(input.provider); clientRefundId = validateClientRefundId(input.clientRefundId); } catch (error) { mapInput(error); }
  for (let attempt = 0; attempt < 3; attempt += 1) { try { return await createOnce(input, provider!, clientRefundId!, client); } catch (error) { if (isRetryableRefundConflict(error) && attempt < 2) continue; if (isRetryableRefundConflict(error)) throw new CreateRefundExecutionError('REFUND_EXECUTION_CONFLICT', 'Refund execution could not be created safely.'); throw error; } }
  throw new CreateRefundExecutionError('REFUND_EXECUTION_CONFLICT', 'Refund execution could not be created safely.');
}
