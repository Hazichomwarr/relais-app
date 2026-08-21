import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';

export type QuickPaymentObligationInput = {
  missionId: string;
};

export type PaymentObligationSummary = {
  id: string;
  missionId: string;
  purpose: 'RELAIS_FEE' | 'MISSION_FUNDS';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  sourceQuickOfferId: string | null;
  createdAt: Date;
  settledAt: Date | null;
  cancelledAt: Date | null;
};

export type CreateQuickPaymentObligationResult = {
  status: 'CREATED' | 'EXISTING';
  obligation: PaymentObligationSummary;
};

export type CreateQuickPaymentObligationErrorCode =
  | 'INVALID_MISSION_ID'
  | 'MISSION_NOT_FOUND'
  | 'INVALID_MISSION_DEPTH'
  | 'ACCEPTED_OFFER_MISSING'
  | 'INVALID_ACCEPTED_OFFER'
  | 'COMMERCIAL_BASIS_MISMATCH'
  | 'OBLIGATION_CONFLICT';

export class CreateQuickPaymentObligationError extends Error {
  readonly code: CreateQuickPaymentObligationErrorCode;

  constructor(code: CreateQuickPaymentObligationErrorCode, message: string) {
    super(message);
    this.name = 'CreateQuickPaymentObligationError';
    this.code = code;
  }
}

const obligationSelect = {
  id: true,
  missionId: true,
  purpose: true,
  amount: true,
  currency: true,
  status: true,
  sourceQuickOfferId: true,
  createdAt: true,
  settledAt: true,
  cancelledAt: true,
} as const;

type LockedMission = {
  id: string;
  connectionId: string;
  depth: 'QUICK' | 'MANAGED';
  acceptedQuickOfferId: string | null;
};

function assertMissionId(missionId: string): void {
  if (typeof missionId !== 'string' || !missionId.trim()) {
    throw new CreateQuickPaymentObligationError('INVALID_MISSION_ID', 'A Mission id is required.');
  }
}

function isRetryableConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2034' || error.code === '40001' || error.code === 'P2002')
  ) ||
    message.includes('40001') ||
    message.includes('could not serialize access') ||
    message.includes('TransactionWriteConflict') ||
    message.includes('write conflict') ||
    message.includes('deadlock');
}

export async function createQuickPaymentObligationInTransaction(
  transaction: Prisma.TransactionClient,
  missionId: string,
): Promise<CreateQuickPaymentObligationResult> {
  assertMissionId(missionId);

  const missions = await transaction.$queryRaw<LockedMission[]>`
    SELECT "id", "connectionId", "depth", "acceptedQuickOfferId"
    FROM "Mission"
    WHERE "id" = ${missionId}
    FOR UPDATE
  `;
  const mission = missions[0];
  if (!mission) {
    throw new CreateQuickPaymentObligationError('MISSION_NOT_FOUND', 'The Mission was not found.');
  }
  if (mission.depth !== 'QUICK') {
    throw new CreateQuickPaymentObligationError(
      'INVALID_MISSION_DEPTH',
      'Only QUICK Missions can create a QUICK RELAIS Fee obligation.',
    );
  }
  if (!mission.acceptedQuickOfferId) {
    throw new CreateQuickPaymentObligationError(
      'ACCEPTED_OFFER_MISSING',
      'The QUICK Mission has no accepted QuickOffer commercial basis.',
    );
  }

  const offer = await transaction.quickOffer.findUnique({
    where: { id: mission.acceptedQuickOfferId },
    select: { id: true, connectionId: true, amount: true, currency: true, status: true },
  });
  if (!offer) {
    throw new CreateQuickPaymentObligationError('INVALID_ACCEPTED_OFFER', 'The accepted QuickOffer was not found.');
  }
  if (offer.status !== 'ACCEPTED') {
    throw new CreateQuickPaymentObligationError(
      'INVALID_ACCEPTED_OFFER',
      'A Payment Obligation may only derive from an accepted QuickOffer.',
    );
  }
  if (offer.connectionId !== mission.connectionId) {
    throw new CreateQuickPaymentObligationError(
      'COMMERCIAL_BASIS_MISMATCH',
      'The accepted QuickOffer does not belong to the Mission Connection.',
    );
  }
  if (!Number.isSafeInteger(offer.amount) || offer.amount <= 0 || !/^[A-Z]{3}$/.test(offer.currency)) {
    throw new CreateQuickPaymentObligationError('INVALID_ACCEPTED_OFFER', 'The accepted QuickOffer has invalid financial terms.');
  }

  const existing = await transaction.paymentObligation.findUnique({
    where: { sourceQuickOfferId: offer.id },
    select: obligationSelect,
  });
  if (existing) {
    if (
      existing.missionId !== mission.id ||
      existing.purpose !== 'RELAIS_FEE' ||
      existing.amount !== offer.amount ||
      existing.currency !== offer.currency
    ) {
      throw new CreateQuickPaymentObligationError(
        'COMMERCIAL_BASIS_MISMATCH',
        'The existing Payment Obligation does not match the accepted QuickOffer.',
      );
    }
    return { status: 'EXISTING', obligation: existing };
  }

  const obligation = await transaction.paymentObligation.create({
    data: {
      missionId: mission.id,
      purpose: 'RELAIS_FEE',
      amount: offer.amount,
      currency: offer.currency,
      status: 'PENDING',
      sourceQuickOfferId: offer.id,
    },
    select: obligationSelect,
  });
  return { status: 'CREATED', obligation };
}

export async function createQuickPaymentObligation(
  input: QuickPaymentObligationInput,
  client: PrismaClient = prisma,
): Promise<CreateQuickPaymentObligationResult> {
  assertMissionId(input.missionId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(
        (transaction) => createQuickPaymentObligationInTransaction(transaction, input.missionId),
        { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 },
      );
    } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) {
        throw new CreateQuickPaymentObligationError(
          'OBLIGATION_CONFLICT',
          'The Payment Obligation could not be created safely.',
        );
      }
      throw error;
    }
  }
  throw new CreateQuickPaymentObligationError('OBLIGATION_CONFLICT', 'The Payment Obligation could not be created safely.');
}
