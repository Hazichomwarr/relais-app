import { PrismaClient } from '@prisma/client';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';

export type RejectQuickOfferInput = {
  actor: AuthorizationSubject;
  quickOfferId: string;
};

export type RejectQuickOfferResult = {
  status: 'REJECTED' | 'ALREADY_REJECTED';
  offer: {
    id: string;
    connectionId: string;
    amount: number;
    currency: string;
    status: 'REJECTED';
    createdAt: Date;
    rejectedAt: Date;
  };
};

export type RejectQuickOfferErrorCode =
  | 'INVALID_OFFER_ID'
  | 'UNAUTHORIZED'
  | 'QUICK_OFFER_NOT_FOUND'
  | 'INVALID_OFFER_STATE'
  | 'STALE_OFFER'
  | 'INVALID_CONNECTION_STATE'
  | 'REJECTION_CONFLICT';

export class RejectQuickOfferError extends Error {
  readonly code: RejectQuickOfferErrorCode;

  constructor(code: RejectQuickOfferErrorCode, message: string) {
    super(message);
    this.name = 'RejectQuickOfferError';
    this.code = code;
  }
}

type LockedOffer = {
  id: string;
  connectionId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'CANCELLED';
  createdAt: Date;
  rejectedAt: Date | null;
};

function validateInput(input: RejectQuickOfferInput): void {
  if (typeof input.quickOfferId !== 'string' || !input.quickOfferId.trim()) {
    throw new RejectQuickOfferError('INVALID_OFFER_ID', 'A QuickOffer id is required.');
  }
  if (!canOperateAsCustomer(input.actor).allowed) {
    throw new RejectQuickOfferError('UNAUTHORIZED', 'Only an active Customer may reject a QUICK Offer.');
  }
}

async function rejectOnce(
  input: RejectQuickOfferInput,
  client: PrismaClient,
): Promise<RejectQuickOfferResult> {
  return client.$transaction(async (transaction) => {
    const offers = await transaction.$queryRaw<LockedOffer[]>`
      SELECT qo."id", qo."connectionId", qo."amount", qo."currency", qo."status", qo."createdAt", qo."rejectedAt"
      FROM "QuickOffer" qo
      INNER JOIN "Connection" c ON c."id" = qo."connectionId"
      WHERE qo."id" = ${input.quickOfferId}
      FOR UPDATE OF c, qo
    `;
    const offer = offers[0];
    if (!offer) throw new RejectQuickOfferError('QUICK_OFFER_NOT_FOUND', 'The QuickOffer was not found.');

    const connection = await transaction.connection.findUnique({
      where: { id: offer.connectionId },
      select: { customerId: true, lifecycle: true, terminalOutcome: true },
    });
    const customer = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true, accountStatus: true },
    });
    if (
      !customer ||
      customer.role !== 'CUSTOMER' ||
      customer.accountStatus !== 'ACTIVE' ||
      connection?.customerId !== input.actor.userId
    ) {
      throw new RejectQuickOfferError('UNAUTHORIZED', 'Only the active owning Customer may reject this QUICK Offer.');
    }
    if (offer.status === 'REJECTED') {
      if (!offer.rejectedAt) throw new RejectQuickOfferError('INVALID_OFFER_STATE', 'The rejected QuickOffer has no rejection timestamp.');
      return { status: 'ALREADY_REJECTED', offer: { ...offer, status: 'REJECTED', rejectedAt: offer.rejectedAt } };
    }
    if (offer.status !== 'PENDING') {
      throw new RejectQuickOfferError(
        offer.status === 'SUPERSEDED' || offer.status === 'CANCELLED' ? 'STALE_OFFER' : 'INVALID_OFFER_STATE',
        'Only the current pending QUICK Offer may be rejected.',
      );
    }
    if (!connection || connection.lifecycle !== 'CONNECTED' || connection.terminalOutcome !== null) {
      throw new RejectQuickOfferError('INVALID_CONNECTION_STATE', 'Only a connected Connection may reject a QUICK Offer.');
    }

    const rejectedRows = await transaction.$queryRaw<Array<{ rejectedAt: Date }>>`
      UPDATE "QuickOffer"
      SET "status" = CAST('REJECTED' AS "QuickOfferStatus"), "rejectedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${offer.id} AND "status" = CAST('PENDING' AS "QuickOfferStatus")
      RETURNING "rejectedAt"
    `;
    const rejectedAt = rejectedRows[0]?.rejectedAt;
    if (!rejectedAt) throw new RejectQuickOfferError('REJECTION_CONFLICT', 'The QUICK Offer changed before rejection completed.');
    return { status: 'REJECTED', offer: { ...offer, status: 'REJECTED', rejectedAt } };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 });
}

export async function rejectQuickOffer(
  input: RejectQuickOfferInput,
  client: PrismaClient = prisma,
): Promise<RejectQuickOfferResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await rejectOnce(input, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.includes('40001') || message.includes('TransactionWriteConflict') || message.includes('write conflict') || message.includes('deadlock');
      if (retryable && attempt < 2) continue;
      if (retryable) throw new RejectQuickOfferError('REJECTION_CONFLICT', 'QUICK Offer rejection could not complete safely.');
      throw error;
    }
  }
  throw new RejectQuickOfferError('REJECTION_CONFLICT', 'QUICK Offer rejection could not complete safely.');
}
