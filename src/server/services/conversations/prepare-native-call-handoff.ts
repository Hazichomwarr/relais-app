import { prisma } from '../../db/client.ts';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';

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

type LockedConversation = {
  conversationId: string;
  connectionId: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
};

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

  const customerAuthorization = canOperateAsCustomer(input.actor);
  const relaisAuthorization = canOperateAsRelais(input.actor);
  if (!customerAuthorization.allowed && !relaisAuthorization.allowed) {
    throw new PrepareNativeCallHandoffError(
      'UNAUTHORIZED',
      'The actor is not authorized to initiate a native call handoff.',
    );
  }

  return client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<LockedConversation[]>`
      SELECT
        conversation."id" AS "conversationId",
        connection."id" AS "connectionId",
        connection."customerId",
        connection."lifecycle"
      FROM "Conversation" conversation
      INNER JOIN "Connection" connection ON connection."id" = conversation."connectionId"
      WHERE conversation."id" = ${input.conversationId}
      FOR UPDATE OF connection
    `;
    const conversation = rows[0];
    if (!conversation) {
      throw new PrepareNativeCallHandoffError('CONVERSATION_NOT_FOUND', 'The Conversation was not found.');
    }
    if (conversation.lifecycle !== 'CONNECTED') {
      throw new PrepareNativeCallHandoffError(
        'CONNECTION_NOT_CONNECTED',
        'Native call handoff requires a CONNECTED Connection.',
      );
    }

    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { id: true, role: true, accountStatus: true, phoneNumber: true, phoneVerifiedAt: true, relaisProfile: { select: { eligibility: true } } },
    });
    if (!actor) {
      throw new PrepareNativeCallHandoffError('UNAUTHORIZED', 'The actor was not found.');
    }

    let target: TargetUser | null = null;
    if (
      customerAuthorization.allowed &&
      actor.role === 'CUSTOMER' &&
      actor.accountStatus === 'ACTIVE' &&
      conversation.customerId === actor.id
    ) {
      const assignment = await transaction.connectionAssignment.findFirst({
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
    } else if (
      relaisAuthorization.allowed &&
      actor.role === 'RELAIS' &&
      actor.accountStatus === 'ACTIVE' &&
      actor.relaisProfile?.eligibility === 'APPROVED'
    ) {
      const assignment = await transaction.connectionAssignment.findFirst({
        where: { connectionId: conversation.connectionId, relaisUserId: actor.id, endedAt: null },
        select: { id: true },
      });
      if (!assignment) {
        throw new PrepareNativeCallHandoffError('UNAUTHORIZED', 'Only the currently assigned Relais may call this Customer.');
      }
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
}
