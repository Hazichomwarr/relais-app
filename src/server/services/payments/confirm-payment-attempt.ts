import { Prisma, PrismaClient } from '@prisma/client';
import { canOperateAsAdmin } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import type { PaymentAttemptSummary } from './create-payment-attempt.ts';
import type { PaymentObligationSummary } from './create-quick-payment-obligation.ts';

export type TrustedPaymentConfirmation = {
  source: 'PROVIDER' | 'MANUAL';
  provider: string;
  externalReference: string;
  confirmedAt: Date;
  confirmedAmount: number;
  currency: string;
  confirmedByUserId?: string;
};

export type ConfirmPaymentAttemptInput = {
  paymentAttemptId: string;
  confirmation: TrustedPaymentConfirmation;
  actor?: AuthorizationSubject;
};

export type ConfirmPaymentAttemptResult = {
  status: 'CONFIRMED' | 'EXISTING';
  attempt: PaymentAttemptSummary;
  obligation: PaymentObligationSummary;
  mission: { id: string; lifecycle: 'ACTIVE' | 'PENDING_EXECUTION' };
};

export type ConfirmPaymentAttemptErrorCode =
  | 'INVALID_PAYMENT_ATTEMPT_ID'
  | 'INVALID_CONFIRMATION'
  | 'PAYMENT_ATTEMPT_NOT_FOUND'
  | 'INVALID_PAYMENT_ATTEMPT_STATE'
  | 'PAYMENT_OBLIGATION_NOT_PAYABLE'
  | 'INVALID_CONFIRMATION_AMOUNT'
  | 'INVALID_CONFIRMATION_CURRENCY'
  | 'EXTERNAL_REFERENCE_CONFLICT'
  | 'UNAUTHORIZED'
  | 'CONFIRMATION_CONFLICT';

export class ConfirmPaymentAttemptError extends Error {
  readonly code: ConfirmPaymentAttemptErrorCode;

  constructor(code: ConfirmPaymentAttemptErrorCode, message: string) {
    super(message);
    this.name = 'ConfirmPaymentAttemptError';
    this.code = code;
  }
}

const attemptSelect = {
  id: true, paymentObligationId: true, amount: true, currency: true, method: true, provider: true,
  status: true, clientAttemptId: true, initiatedAt: true, confirmedAt: true, failedAt: true, failureCode: true, externalReference: true,
} as const;
const obligationSelect = {
  id: true, missionId: true, purpose: true, amount: true, currency: true, status: true,
  sourceQuickOfferId: true, createdAt: true, settledAt: true, cancelledAt: true,
} as const;

function validateInput(input: ConfirmPaymentAttemptInput): void {
  if (typeof input.paymentAttemptId !== 'string' || !input.paymentAttemptId.trim()) throw new ConfirmPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_ID', 'A Payment Attempt id is required.');
  const confirmation = input.confirmation;
  if (!confirmation || !['PROVIDER', 'MANUAL'].includes(confirmation.source) || typeof confirmation.provider !== 'string' || !confirmation.provider.trim() || typeof confirmation.externalReference !== 'string' || !confirmation.externalReference.trim() || !(confirmation.confirmedAt instanceof Date) || !Number.isSafeInteger(confirmation.confirmedAmount) || confirmation.confirmedAmount <= 0 || typeof confirmation.currency !== 'string' || !/^[A-Z]{3}$/.test(confirmation.currency)) {
    throw new ConfirmPaymentAttemptError('INVALID_CONFIRMATION', 'Trusted payment confirmation evidence is incomplete or invalid.');
  }
  if (confirmation.source === 'MANUAL' && !input.actor) throw new ConfirmPaymentAttemptError('UNAUTHORIZED', 'Manual confirmation requires an authorized Admin actor.');
}

function isRetryableConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error && (error.code === 'P2034' || error.code === '40001' || error.code === 'P2002')) || message.includes('40001') || message.includes('could not serialize access') || message.includes('TransactionWriteConflict') || message.includes('write conflict') || message.includes('deadlock');
}

async function confirmOnce(input: ConfirmPaymentAttemptInput, client: PrismaClient): Promise<ConfirmPaymentAttemptResult> {
  return client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string; paymentObligationId: string }>>`
      SELECT "id", "paymentObligationId" FROM "PaymentAttempt" WHERE "id" = ${input.paymentAttemptId} FOR UPDATE
    `;
    const locked = rows[0];
    if (!locked) throw new ConfirmPaymentAttemptError('PAYMENT_ATTEMPT_NOT_FOUND', 'The Payment Attempt was not found.');
    const attempt = await transaction.paymentAttempt.findUnique({ where: { id: locked.id }, select: { ...attemptSelect, paymentObligation: { select: { ...obligationSelect, mission: { select: { id: true, depth: true, lifecycle: true } } } } } });
    if (!attempt) throw new ConfirmPaymentAttemptError('PAYMENT_ATTEMPT_NOT_FOUND', 'The Payment Attempt was not found.');
    const confirmation = input.confirmation;

    if (attempt.status === 'SUCCEEDED') {
      if (attempt.externalReference === confirmation.externalReference && attempt.provider === confirmation.provider && attempt.amount === confirmation.confirmedAmount && attempt.currency === confirmation.currency) {
        return { status: 'EXISTING', attempt, obligation: attempt.paymentObligation, mission: { id: attempt.paymentObligation.mission.id, lifecycle: attempt.paymentObligation.mission.lifecycle === 'ACTIVE' ? 'ACTIVE' : 'PENDING_EXECUTION' } };
      }
      throw new ConfirmPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_STATE', 'This Payment Attempt has already succeeded with different confirmation evidence.');
    }
    if (!['INITIATED', 'PENDING'].includes(attempt.status)) throw new ConfirmPaymentAttemptError('INVALID_PAYMENT_ATTEMPT_STATE', 'Only an active Payment Attempt may be confirmed.');
    if (attempt.paymentObligation.status !== 'PENDING') throw new ConfirmPaymentAttemptError('PAYMENT_OBLIGATION_NOT_PAYABLE', 'The Payment Obligation is no longer payable.');
    if (confirmation.provider !== attempt.provider || confirmation.confirmedAmount !== attempt.amount) throw new ConfirmPaymentAttemptError('INVALID_CONFIRMATION_AMOUNT', 'Confirmed payment amount or provider does not match the attempt.');
    if (confirmation.currency !== attempt.currency) throw new ConfirmPaymentAttemptError('INVALID_CONFIRMATION_CURRENCY', 'Confirmed payment currency does not match the obligation.');

    if (confirmation.source === 'MANUAL') {
      if (!input.actor || !canOperateAsAdmin(input.actor).allowed || input.actor.userId !== confirmation.confirmedByUserId) throw new ConfirmPaymentAttemptError('UNAUTHORIZED', 'Only the active Admin confirmer may manually confirm payment.');
      const confirmer = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
      if (!confirmer || confirmer.role !== 'ADMIN' || confirmer.accountStatus !== 'ACTIVE') throw new ConfirmPaymentAttemptError('UNAUTHORIZED', 'Only an active Admin may manually confirm payment.');
    }
    const reused = await transaction.paymentAttempt.findFirst({ where: { provider: confirmation.provider, externalReference: confirmation.externalReference, id: { not: attempt.id } }, select: { id: true } });
    if (reused) throw new ConfirmPaymentAttemptError('EXTERNAL_REFERENCE_CONFLICT', 'The external payment reference was already used.');

    const confirmedAt = confirmation.confirmedAt;
    const updatedAttempt = await transaction.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'SUCCEEDED', confirmedAt, externalReference: confirmation.externalReference, confirmationSource: confirmation.source, confirmedByUserId: confirmation.confirmedByUserId ?? null }, select: attemptSelect });
    const updatedObligation = await transaction.paymentObligation.update({ where: { id: attempt.paymentObligationId }, data: { status: 'PAID', settledAt: confirmedAt }, select: obligationSelect });
    const missionUpdate = attempt.paymentObligation.purpose === 'RELAIS_FEE' && attempt.paymentObligation.mission.depth === 'QUICK' && attempt.paymentObligation.mission.lifecycle === 'PENDING_EXECUTION'
      ? await transaction.mission.update({ where: { id: attempt.paymentObligation.mission.id }, data: { lifecycle: 'ACTIVE' }, select: { id: true, lifecycle: true } })
      : attempt.paymentObligation.mission;
    return { status: 'CONFIRMED', attempt: updatedAttempt, obligation: updatedObligation, mission: { id: missionUpdate.id, lifecycle: missionUpdate.lifecycle === 'ACTIVE' ? 'ACTIVE' : 'PENDING_EXECUTION' } };
  }, serializableTransactionOptions());
}

export async function confirmPaymentAttempt(input: ConfirmPaymentAttemptInput, client: PrismaClient = prisma): Promise<ConfirmPaymentAttemptResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await confirmOnce(input, client); } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) throw new ConfirmPaymentAttemptError('CONFIRMATION_CONFLICT', 'Payment confirmation could not complete safely.');
      throw error;
    }
  }
  throw new ConfirmPaymentAttemptError('CONFIRMATION_CONFLICT', 'Payment confirmation could not complete safely.');
}
