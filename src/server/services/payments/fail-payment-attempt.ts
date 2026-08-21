import { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';
import type { PaymentAttemptSummary } from './create-payment-attempt.ts';

export type FailPaymentAttemptInput = { paymentAttemptId: string; failureCode?: string };
export type FailPaymentAttemptResult = { status: 'FAILED' | 'EXISTING'; attempt: PaymentAttemptSummary };
export type FailPaymentAttemptErrorCode = 'INVALID_PAYMENT_ATTEMPT_ID' | 'PAYMENT_ATTEMPT_NOT_FOUND' | 'INVALID_PAYMENT_ATTEMPT_STATE' | 'FAILURE_CONFLICT';

export class FailPaymentAttemptError extends Error {
  readonly code: FailPaymentAttemptErrorCode;
  constructor(code: FailPaymentAttemptErrorCode, message: string) { super(message); this.name = 'FailPaymentAttemptError'; this.code = code; }
}

const attemptSelect = {
  id: true, paymentObligationId: true, amount: true, currency: true, method: true, provider: true,
  status: true, clientAttemptId: true, initiatedAt: true, confirmedAt: true, failedAt: true, failureCode: true,
} as const;

export async function failPaymentAttempt(input: FailPaymentAttemptInput, client: PrismaClient = prisma): Promise<FailPaymentAttemptResult> {
  if (typeof input.paymentAttemptId !== 'string' || !input.paymentAttemptId.trim()) throw new FailPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_ID', 'A Payment Attempt id is required.');
  if (input.failureCode && (input.failureCode.length > 64 || !/^[A-Z0-9_.-]+$/.test(input.failureCode))) throw new FailPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_STATE', 'The failure code is invalid.');
  return client.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${input.paymentAttemptId} FOR UPDATE`;
    const current = await transaction.paymentAttempt.findUnique({ where: { id: input.paymentAttemptId }, select: attemptSelect });
    if (!current) throw new FailPaymentAttemptError('PAYMENT_ATTEMPT_NOT_FOUND', 'The Payment Attempt was not found.');
    if (current.status === 'FAILED') return { status: 'EXISTING', attempt: current };
    if (!['INITIATED', 'PENDING'].includes(current.status)) throw new FailPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_STATE', 'Only an active Payment Attempt may fail.');
    const attempt = await transaction.paymentAttempt.update({ where: { id: current.id }, data: { status: 'FAILED', failedAt: new Date(), failureCode: input.failureCode ?? null }, select: attemptSelect });
    return { status: 'FAILED', attempt };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 });
}
