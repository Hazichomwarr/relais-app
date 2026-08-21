import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import {
  authorizeConversationParticipant,
  ConversationAuthorizationError,
} from './conversation-authorization.ts';

export type PrepareNativeCallHandoffInput = {
  actor: AuthorizationSubject;
  conversationId: string;
};

export type PrepareNativeCallHandoffResult = {
  callActionId: string;
  target: {
    userId: string;
    phoneNumber: string;
    phoneUri: string;
  };
  initiatedAt: Date;
};

export type PrepareNativeCallHandoffErrorCode =
  | 'INVALID_CONVERSATION_ID'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'CALL_TARGET_UNAVAILABLE';

export class PrepareNativeCallHandoffError extends Error {
  readonly code: PrepareNativeCallHandoffErrorCode;

  constructor(code: PrepareNativeCallHandoffErrorCode, message: string) {
    super(message);
    this.name = 'PrepareNativeCallHandoffError';
    this.code = code;
  }
}

type TargetUser = {
  id: string;
  role: 'CUSTOMER' | 'RELAIS' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  relaisProfile: { eligibility: 'APPROVED' | 'UNDER_REVIEW' | 'REVOKED' } | null;
};

function assertValidPhone(target: TargetUser): string {
  if (
    !target.phoneNumber ||
    !target.phoneVerifiedAt ||
    !/^\+[1-9]\d{7,14}$/.test(target.phoneNumber)
  ) {
    throw new PrepareNativeCallHandoffError(
      'CALL_TARGET_UNAVAILABLE',
      'The authorized call target does not have a usable verified phone number.',
    );
  }
  return target.phoneNumber;
}

export async function prepareNativeCallHandoff(
  input: PrepareNativeCallHandoffInput,
  client: PrismaClient = prisma,
): Promise<PrepareNativeCallHandoffResult> {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) {
    throw new PrepareNativeCallHandoffError(
      'INVALID_CONVERSATION_ID',
      'A Conversation id is required.',
    );
  }

  try {
    return await client.$transaction(async (transaction) => {
    const conversation = await authorizeConversationParticipant(
      transaction,
      input.actor,
      input.conversationId,
    );

    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { id: true, role: true, accountStatus: true, phoneNumber: true, phoneVerifiedAt: true, relaisProfile: { select: { eligibility: true } } },
    });
    if (!actor) {
      throw new PrepareNativeCallHandoffError('UNAUTHORIZED', 'The actor was not found.');
    }

    let target: TargetUser | null = null;
    if (actor.role === 'CUSTOMER' && conversation.customerId === actor.id) {
      const assignment = conversation.missionId
        ? await transaction.missionAssignment.findFirst({
            where: { missionId: conversation.missionId, endedAt: null },
            select: { relaisUser: { select: { id: true, role: true, accountStatus: true, phoneNumber: true, phoneVerifiedAt: true, relaisProfile: { select: { eligibility: true } } } } },
          })
        : await transaction.connectionAssignment.findFirst({
            where: { connectionId: conversation.connectionId, endedAt: null },
            select: { relaisUser: { select: { id: true, role: true, accountStatus: true, phoneNumber: true, phoneVerifiedAt: true, relaisProfile: { select: { eligibility: true } } } } },
          });
      target = assignment?.relaisUser ?? null;
      if (
        !target ||
        target.role !== 'RELAIS' ||
        target.accountStatus !== 'ACTIVE' ||
        target.relaisProfile?.eligibility !== 'APPROVED'
      ) {
        throw new PrepareNativeCallHandoffError('CALL_TARGET_UNAVAILABLE', 'The current assigned Relais is not callable.');
      }
    } else if (actor.role === 'RELAIS') {
      target = await transaction.user.findUnique({
        where: { id: conversation.customerId },
        select: { id: true, role: true, accountStatus: true, phoneNumber: true, phoneVerifiedAt: true, relaisProfile: { select: { eligibility: true } } },
      });
      if (!target || target.role !== 'CUSTOMER') {
        throw new PrepareNativeCallHandoffError('CALL_TARGET_UNAVAILABLE', 'The Conversation Customer is not callable.');
      }
    } else {
      throw new PrepareNativeCallHandoffError('UNAUTHORIZED', 'The actor is not an authorized Conversation participant.');
    }

    const phoneNumber = assertValidPhone(target);
    const callAction = await transaction.callAction.create({
      data: {
        conversationId: conversation.conversationId,
        initiatedByUserId: input.actor.userId,
        targetUserId: target.id,
        targetPhoneNumber: phoneNumber,
      },
      select: { id: true, targetUserId: true, targetPhoneNumber: true, initiatedAt: true },
    });

    return {
      callActionId: callAction.id,
      target: {
        userId: callAction.targetUserId,
        phoneNumber: callAction.targetPhoneNumber,
        phoneUri: `tel:${callAction.targetPhoneNumber}`,
      },
      initiatedAt: callAction.initiatedAt,
    };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof ConversationAuthorizationError) {
      throw new PrepareNativeCallHandoffError(error.code, error.message);
    }
    throw error;
  }
}
