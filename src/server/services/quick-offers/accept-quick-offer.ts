import { PrismaClient } from '@prisma/client';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';

export type AcceptQuickOfferInput = {
  actor: AuthorizationSubject;
  quickOfferId: string;
};

export type AcceptedMission = {
  id: string;
  connectionId: string;
  depth: 'QUICK';
  urgency: 'NORMAL';
  lifecycle: 'PENDING_EXECUTION';
  acceptedQuickOfferId: string;
  createdAt: Date;
};

export type AcceptQuickOfferResult = {
  status: 'ACCEPTED' | 'EXISTING';
  offer: {
    id: string;
    connectionId: string;
    amount: number;
    currency: string;
    status: 'ACCEPTED';
    createdAt: Date;
    acceptedAt: Date;
  };
  mission: AcceptedMission;
};

export type AcceptQuickOfferErrorCode =
  | 'INVALID_OFFER_ID'
  | 'UNAUTHORIZED'
  | 'QUICK_OFFER_NOT_FOUND'
  | 'INVALID_OFFER_STATE'
  | 'STALE_OFFER'
  | 'INVALID_CONNECTION_STATE'
  | 'CONNECTION_INTEGRITY_ERROR'
  | 'MISSION_ALREADY_EXISTS'
  | 'ACCEPTANCE_CONFLICT';

export class AcceptQuickOfferError extends Error {
  readonly code: AcceptQuickOfferErrorCode;

  constructor(code: AcceptQuickOfferErrorCode, message: string) {
    super(message);
    this.name = 'AcceptQuickOfferError';
    this.code = code;
  }
}

const offerSelect = {
  id: true,
  connectionId: true,
  amount: true,
  currency: true,
  status: true,
  createdAt: true,
  acceptedAt: true,
} as const;

type LockedOffer = {
  id: string;
  connectionId: string;
  createdByRelaisUserId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'CANCELLED';
  createdAt: Date;
  acceptedAt: Date | null;
};

function validateInput(input: AcceptQuickOfferInput): void {
  if (typeof input.quickOfferId !== 'string' || !input.quickOfferId.trim()) {
    throw new AcceptQuickOfferError('INVALID_OFFER_ID', 'A QuickOffer id is required.');
  }
  if (!canOperateAsCustomer(input.actor).allowed) {
    throw new AcceptQuickOfferError('UNAUTHORIZED', 'Only an active Customer may accept a QUICK Offer.');
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

function missionResult(mission: {
  id: string;
  connectionId: string;
  depth: 'QUICK' | 'MANAGED';
  urgency: 'NORMAL' | 'URGENT';
  lifecycle: 'PENDING_EXECUTION' | 'ACTIVE' | 'COMPLETION_PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  acceptedQuickOfferId: string | null;
  createdAt: Date;
}): AcceptedMission {
  if (
    mission.depth !== 'QUICK' ||
    mission.urgency !== 'NORMAL' ||
    mission.lifecycle !== 'PENDING_EXECUTION' ||
    !mission.acceptedQuickOfferId
  ) {
    throw new AcceptQuickOfferError('CONNECTION_INTEGRITY_ERROR', 'The stored QUICK Mission has invalid initial state.');
  }
  return {
    id: mission.id,
    connectionId: mission.connectionId,
    depth: 'QUICK',
    urgency: 'NORMAL',
    lifecycle: 'PENDING_EXECUTION',
    acceptedQuickOfferId: mission.acceptedQuickOfferId,
    createdAt: mission.createdAt,
  };
}

async function acceptOnce(
  input: AcceptQuickOfferInput,
  client: PrismaClient,
): Promise<AcceptQuickOfferResult> {
  return client.$transaction(async (transaction) => {
    const connections = await transaction.$queryRaw<Array<{
      id: string;
      customerId: string;
      lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
      terminalOutcome: string | null;
    }>>`
      SELECT "id", "customerId", "lifecycle", "terminalOutcome"
      FROM "Connection"
      WHERE "id" = (SELECT "connectionId" FROM "QuickOffer" WHERE "id" = ${input.quickOfferId})
      FOR UPDATE
    `;
    const connection = connections[0];

    const offers = await transaction.$queryRaw<LockedOffer[]>`
      SELECT "id", "connectionId", "createdByRelaisUserId", "amount", "currency", "status", "createdAt", "acceptedAt"
      FROM "QuickOffer"
      WHERE "id" = ${input.quickOfferId}
      FOR UPDATE
    `;
    const offer = offers[0];
    if (!offer || !connection) {
      throw new AcceptQuickOfferError('QUICK_OFFER_NOT_FOUND', 'The QuickOffer was not found.');
    }
    if (connection.customerId !== input.actor.userId) {
      throw new AcceptQuickOfferError('UNAUTHORIZED', 'Only the owning Customer may accept this QUICK Offer.');
    }

    const customer = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true, accountStatus: true },
    });
    if (!customer || customer.role !== 'CUSTOMER' || customer.accountStatus !== 'ACTIVE') {
      throw new AcceptQuickOfferError('UNAUTHORIZED', 'Only an active owning Customer may accept this QUICK Offer.');
    }

    const existingMission = await transaction.mission.findUnique({
      where: { connectionId: offer.connectionId },
      select: { id: true, connectionId: true, depth: true, urgency: true, lifecycle: true, acceptedQuickOfferId: true, createdAt: true },
    });
    if (offer.status === 'ACCEPTED') {
      if (!existingMission || existingMission.acceptedQuickOfferId !== offer.id || !offer.acceptedAt) {
        throw new AcceptQuickOfferError('CONNECTION_INTEGRITY_ERROR', 'The accepted QuickOffer has no matching Mission.');
      }
      return {
        status: 'EXISTING',
        offer: { ...offer, status: 'ACCEPTED', acceptedAt: offer.acceptedAt },
        mission: missionResult(existingMission),
      };
    }
    if (offer.status !== 'PENDING') {
      throw new AcceptQuickOfferError(
        offer.status === 'SUPERSEDED' || offer.status === 'CANCELLED' || offer.status === 'REJECTED'
          ? 'STALE_OFFER'
          : 'INVALID_OFFER_STATE',
        'Only the current pending QUICK Offer may be accepted.',
      );
    }
    if (existingMission) {
      throw new AcceptQuickOfferError('MISSION_ALREADY_EXISTS', 'This Connection already has a Mission.');
    }
    if (connection.lifecycle !== 'CONNECTED' || connection.terminalOutcome !== null) {
      throw new AcceptQuickOfferError('INVALID_CONNECTION_STATE', 'Only a connected Connection may create a Mission.');
    }

    const assignment = await transaction.connectionAssignment.findFirst({
      where: { connectionId: offer.connectionId, endedAt: null },
      select: { id: true, relaisUserId: true },
    });
    if (!assignment) {
      throw new AcceptQuickOfferError('CONNECTION_INTEGRITY_ERROR', 'The connected Connection has no current Relais assignment.');
    }
    if (assignment.relaisUserId !== offer.createdByRelaisUserId) {
      throw new AcceptQuickOfferError('STALE_OFFER', 'The QUICK Offer is no longer from the current assigned Relais.');
    }
    const conversation = await transaction.conversation.findUnique({
      where: { connectionId: offer.connectionId },
      select: { id: true },
    });
    if (!conversation) {
      throw new AcceptQuickOfferError('CONNECTION_INTEGRITY_ERROR', 'A Conversation is required before Mission creation.');
    }

    const acceptedRows = await transaction.$queryRaw<Array<{ acceptedAt: Date }>>`
      UPDATE "QuickOffer"
      SET "status" = CAST('ACCEPTED' AS "QuickOfferStatus"), "acceptedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${offer.id} AND "status" = CAST('PENDING' AS "QuickOfferStatus")
      RETURNING "acceptedAt"
    `;
    const acceptedAt = acceptedRows[0]?.acceptedAt;
    if (!acceptedAt) {
      throw new AcceptQuickOfferError('STALE_OFFER', 'The QUICK Offer changed before acceptance completed.');
    }

    const mission = await transaction.mission.create({
      data: {
        connectionId: offer.connectionId,
        depth: 'QUICK',
        urgency: 'NORMAL',
        lifecycle: 'PENDING_EXECUTION',
        acceptedQuickOfferId: offer.id,
        assignments: {
          create: {
            relaisUserId: assignment.relaisUserId,
            assignedAt: acceptedAt,
          },
        },
      },
      select: { id: true, connectionId: true, depth: true, urgency: true, lifecycle: true, acceptedQuickOfferId: true, createdAt: true },
    });
    await transaction.connectionAssignment.updateMany({
      where: { connectionId: offer.connectionId, endedAt: null },
      data: { endedAt: acceptedAt },
    });
    await transaction.connection.update({
      where: { id: offer.connectionId },
      data: { lifecycle: 'ENDED', terminalOutcome: 'MISSION_CREATED', endedAt: acceptedAt },
    });

    return {
      status: 'ACCEPTED',
      offer: { ...offer, status: 'ACCEPTED', acceptedAt },
      mission: missionResult(mission),
    };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 });
}

export async function acceptQuickOffer(
  input: AcceptQuickOfferInput,
  client: PrismaClient = prisma,
): Promise<AcceptQuickOfferResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await acceptOnce(input, client);
    } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) {
        throw new AcceptQuickOfferError('ACCEPTANCE_CONFLICT', 'QUICK Offer acceptance could not complete safely.');
      }
      throw error;
    }
  }
  throw new AcceptQuickOfferError('ACCEPTANCE_CONFLICT', 'QUICK Offer acceptance could not complete safely.');
}
