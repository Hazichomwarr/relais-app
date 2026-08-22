import { Prisma, PrismaClient } from '@prisma/client';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';

export type CreatePaymentAttemptInput = {
  actor: AuthorizationSubject;
  paymentObligationId: string;
  method: 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'MANUAL_TRANSFER';
  provider: string;
  clientAttemptId: string;
};

export type PaymentAttemptSummary = {
  id: string;
  paymentObligationId: string;
  amount: number;
  currency: string;
  method: CreatePaymentAttemptInput['method'];
  provider: string;
  status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  clientAttemptId: string;
  initiatedAt: Date;
  confirmedAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
};

export type CreatePaymentAttemptResult = { status: 'CREATED' | 'EXISTING'; attempt: PaymentAttemptSummary };

export type CreatePaymentAttemptErrorCode =
  | 'INVALID_PAYMENT_OBLIGATION_ID'
  | 'INVALID_CLIENT_ATTEMPT_ID'
  | 'INVALID_PROVIDER'
  | 'UNAUTHORIZED'
  | 'PAYMENT_OBLIGATION_NOT_FOUND'
  | 'PAYMENT_OBLIGATION_NOT_PAYABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ACTIVE_PAYMENT_ATTEMPT_EXISTS'
  | 'ATTEMPT_CONFLICT';

export class CreatePaymentAttemptError extends Error {
  readonly code: CreatePaymentAttemptErrorCode;

  constructor(code: CreatePaymentAttemptErrorCode, message: string) {
    super(message);
    this.name = 'CreatePaymentAttemptError';
    this.code = code;
  }
}

const attemptSelect = {
  id: true,
  paymentObligationId: true,
  amount: true,
  currency: true,
  method: true,
  provider: true,
  status: true,
  clientAttemptId: true,
  initiatedAt: true,
  confirmedAt: true,
  failedAt: true,
  failureCode: true,
} as const;

function validateInput(input: CreatePaymentAttemptInput): void {
  if (typeof input.paymentObligationId !== 'string' || !input.paymentObligationId.trim()) {
    throw new CreatePaymentAttemptError('INVALID_PAYMENT_OBLIGATION_ID', 'A Payment Obligation id is required.');
  }
  if (typeof input.clientAttemptId !== 'string' || !input.clientAttemptId.trim() || input.clientAttemptId.length > 128) {
    throw new CreatePaymentAttemptError('INVALID_CLIENT_ATTEMPT_ID', 'A valid client attempt id is required.');
  }
  if (typeof input.provider !== 'string' || !input.provider.trim() || input.provider.length > 64) {
    throw new CreatePaymentAttemptError('INVALID_PROVIDER', 'A valid payment provider code is required.');
  }
  if (!canOperateAsCustomer(input.actor).allowed) {
    throw new CreatePaymentAttemptError('UNAUTHORIZED', 'Only an active Customer may initiate payment.');
  }
}

function isRetryableConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2034' || error.code === '40001' || error.code === 'P2002')) ||
    message.includes('40001') || message.includes('could not serialize access') || message.includes('TransactionWriteConflict') || message.includes('write conflict') || message.includes('deadlock');
}

async function createOnce(input: CreatePaymentAttemptInput, client: PrismaClient): Promise<CreatePaymentAttemptResult> {
  return client.$transaction(async (transaction) => {
    const obligations = await transaction.$queryRaw<Array<{ id: string; missionId: string; amount: number; currency: string; status: string; customerId: string }>>`
      SELECT po."id", po."missionId", po."amount", po."currency", po."status", c."customerId"
      FROM "PaymentObligation" po
      JOIN "Mission" m ON m."id" = po."missionId"
      JOIN "Connection" c ON c."id" = m."connectionId"
      WHERE po."id" = ${input.paymentObligationId}
      FOR UPDATE OF po
    `;
    const obligation = obligations[0];
    if (!obligation) throw new CreatePaymentAttemptError('PAYMENT_OBLIGATION_NOT_FOUND', 'The Payment Obligation was not found.');

    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    if (!actor || actor.role !== 'CUSTOMER' || actor.accountStatus !== 'ACTIVE' || obligation.customerId !== input.actor.userId) {
      throw new CreatePaymentAttemptError('UNAUTHORIZED', 'Only the owning active Customer may initiate this payment.');
    }
    if (obligation.status !== 'PENDING') {
      throw new CreatePaymentAttemptError('PAYMENT_OBLIGATION_NOT_PAYABLE', 'This Payment Obligation is no longer payable.');
    }

    const existing = await transaction.paymentAttempt.findUnique({ where: { paymentObligationId_clientAttemptId: { paymentObligationId: obligation.id, clientAttemptId: input.clientAttemptId } }, select: attemptSelect });
    if (existing) {
      if (existing.method !== input.method || existing.provider !== input.provider) {
        throw new CreatePaymentAttemptError('IDEMPOTENCY_CONFLICT', 'The client attempt id was already used with different payment intent.');
      }
      return { status: 'EXISTING', attempt: existing };
    }

    const active = await transaction.paymentAttempt.findFirst({ where: { paymentObligationId: obligation.id, status: { in: ['INITIATED', 'PENDING'] } }, select: { id: true } });
    if (active) throw new CreatePaymentAttemptError('ACTIVE_PAYMENT_ATTEMPT_EXISTS', 'An active Payment Attempt already exists for this obligation.');

    const attempt = await transaction.paymentAttempt.create({
      data: { paymentObligationId: obligation.id, amount: obligation.amount, currency: obligation.currency, method: input.method, provider: input.provider.trim(), clientAttemptId: input.clientAttemptId },
      select: attemptSelect,
    });
    return { status: 'CREATED', attempt };
  }, serializableTransactionOptions());
}

export async function createPaymentAttempt(input: CreatePaymentAttemptInput, client: PrismaClient = prisma): Promise<CreatePaymentAttemptResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await createOnce(input, client); } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) throw new CreatePaymentAttemptError('ATTEMPT_CONFLICT', 'The Payment Attempt could not be created safely.');
      throw error;
    }
  }
  throw new CreatePaymentAttemptError('ATTEMPT_CONFLICT', 'The Payment Attempt could not be created safely.');
}
