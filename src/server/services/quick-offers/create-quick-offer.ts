import { PrismaClient } from '@prisma/client';
import { canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';

export const DEFAULT_QUICK_OFFER_CURRENCY = 'XOF';
export const MAX_QUICK_OFFER_AMOUNT = 10_000_000;
export const MAX_CLIENT_OFFER_ID_LENGTH = 128;

export type CreateQuickOfferInput = {
  actor: AuthorizationSubject;
  connectionId: string;
  amount: number;
  currency?: string;
  clientOfferId: string;
};

export type QuickOffer = {
  id: string;
  connectionId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'CANCELLED';
  createdAt: Date;
};

export type CreateQuickOfferResult = {
  status: 'CREATED' | 'EXISTING';
  offer: QuickOffer;
};

export type CreateQuickOfferErrorCode =
  | 'INVALID_CONNECTION_ID'
  | 'INVALID_AMOUNT'
  | 'AMOUNT_TOO_HIGH'
  | 'INVALID_CURRENCY'
  | 'INVALID_CLIENT_OFFER_ID'
  | 'UNAUTHORIZED'
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'CONNECTION_INTEGRITY_ERROR'
  | 'NOT_CURRENT_RELAIS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'OFFER_CREATION_CONFLICT';

export class CreateQuickOfferError extends Error {
  readonly code: CreateQuickOfferErrorCode;

  constructor(code: CreateQuickOfferErrorCode, message: string) {
    super(message);
    this.name = 'CreateQuickOfferError';
    this.code = code;
  }
}

const quickOfferSelect = {
  id: true,
  connectionId: true,
  amount: true,
  currency: true,
  status: true,
  createdAt: true,
} as const;

function validateInput(input: CreateQuickOfferInput): { currency: string } {
  if (typeof input.connectionId !== 'string' || !input.connectionId.trim()) {
    throw new CreateQuickOfferError('INVALID_CONNECTION_ID', 'A Connection id is required.');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new CreateQuickOfferError('INVALID_AMOUNT', 'The QUICK Offer amount must be a positive integer.');
  }
  if (input.amount > MAX_QUICK_OFFER_AMOUNT) {
    throw new CreateQuickOfferError(
      'AMOUNT_TOO_HIGH',
      `The QUICK Offer amount cannot exceed ${MAX_QUICK_OFFER_AMOUNT} XOF.`,
    );
  }
  const currency = (input.currency ?? DEFAULT_QUICK_OFFER_CURRENCY).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new CreateQuickOfferError('INVALID_CURRENCY', 'Currency must be a three-letter ISO-style code.');
  }
  if (
    typeof input.clientOfferId !== 'string' ||
    !input.clientOfferId.trim() ||
    input.clientOfferId.length > MAX_CLIENT_OFFER_ID_LENGTH
  ) {
    throw new CreateQuickOfferError(
      'INVALID_CLIENT_OFFER_ID',
      `Client offer id must be between 1 and ${MAX_CLIENT_OFFER_ID_LENGTH} characters.`,
    );
  }
  if (!canOperateAsRelais(input.actor).allowed) {
    throw new CreateQuickOfferError('UNAUTHORIZED', 'Only an active approved Relais may create a QUICK Offer.');
  }
  return { currency };
}

function isSerializationConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2034' || error.code === '40001')
  ) ||
    message.includes('40001') ||
    message.includes('could not serialize access') ||
    message.includes('TransactionWriteConflict') ||
    message.includes('write conflict') ||
    message.includes('deadlock');
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function createOnce(
  input: CreateQuickOfferInput,
  currency: string,
  client: PrismaClient,
): Promise<CreateQuickOfferResult> {
  return client.$transaction(
    async (transaction) => {
      const connections = await transaction.$queryRaw<Array<{
        id: string;
        lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
      }>>`
        SELECT c."id", c."lifecycle"
        FROM "Connection" c
        WHERE c."id" = ${input.connectionId}
        FOR UPDATE
      `;
      const connection = connections[0];
      if (!connection) {
        throw new CreateQuickOfferError('CONNECTION_NOT_FOUND', 'The Connection was not found.');
      }
      if (connection.lifecycle !== 'CONNECTED') {
        throw new CreateQuickOfferError(
          'CONNECTION_NOT_CONNECTED',
          'QUICK Offers require a CONNECTED Connection.',
        );
      }

      const actor = await transaction.user.findUnique({
        where: { id: input.actor.userId },
        select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
      });
      if (
        !actor ||
        actor.role !== 'RELAIS' ||
        actor.accountStatus !== 'ACTIVE' ||
        actor.relaisProfile?.eligibility !== 'APPROVED'
      ) {
        throw new CreateQuickOfferError('UNAUTHORIZED', 'Only an active approved Relais may create a QUICK Offer.');
      }

      const assignment = await transaction.connectionAssignment.findFirst({
        where: { connectionId: input.connectionId, relaisUserId: input.actor.userId, endedAt: null },
        select: { id: true },
      });
      if (!assignment) {
        throw new CreateQuickOfferError('NOT_CURRENT_RELAIS', 'Only the current assigned Relais may create a QUICK Offer.');
      }

      const conversation = await transaction.conversation.findUnique({
        where: { connectionId: input.connectionId },
        select: { id: true },
      });
      if (!conversation) {
        throw new CreateQuickOfferError(
          'CONNECTION_INTEGRITY_ERROR',
          'A CONNECTED Connection must have a Conversation before receiving a QUICK Offer.',
        );
      }

      const existing = await transaction.quickOffer.findUnique({
        where: {
          connectionId_createdByRelaisUserId_clientOfferId: {
            connectionId: input.connectionId,
            createdByRelaisUserId: input.actor.userId,
            clientOfferId: input.clientOfferId,
          },
        },
        select: quickOfferSelect,
      });
      if (existing) {
        if (existing.amount !== input.amount || existing.currency !== currency) {
          throw new CreateQuickOfferError(
            'IDEMPOTENCY_CONFLICT',
            'The client offer id was already used with a different amount or currency.',
          );
        }
        return { status: 'EXISTING', offer: existing as QuickOffer };
      }

      const pending = await transaction.quickOffer.findFirst({
        where: { connectionId: input.connectionId, status: 'PENDING' },
        select: { id: true },
      });
      if (pending) {
        await transaction.quickOffer.update({
          where: { id: pending.id },
          data: { status: 'SUPERSEDED', supersededAt: new Date() },
        });
      }

      const created = await transaction.quickOffer.create({
        data: {
          connectionId: input.connectionId,
          createdByRelaisUserId: input.actor.userId,
          amount: input.amount,
          currency,
          clientOfferId: input.clientOfferId,
        },
        select: quickOfferSelect,
      });
      return { status: 'CREATED', offer: created as QuickOffer };
    },
    { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 },
  );
}

export async function createQuickOffer(
  input: CreateQuickOfferInput,
  client: PrismaClient = prisma,
): Promise<CreateQuickOfferResult> {
  const { currency } = validateInput(input);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createOnce(input, currency, client);
    } catch (error) {
      if ((isSerializationConflict(error) || isUniqueConflict(error)) && attempt < 2) {
        continue;
      }
      if (isUniqueConflict(error)) {
        throw new CreateQuickOfferError(
          'OFFER_CREATION_CONFLICT',
          'The QUICK Offer could not be created because another offer changed the Connection concurrently.',
        );
      }
      throw error;
    }
  }

  throw new CreateQuickOfferError('OFFER_CREATION_CONFLICT', 'The QUICK Offer could not be created safely.');
}
