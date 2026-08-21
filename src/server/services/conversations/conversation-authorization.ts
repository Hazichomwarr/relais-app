import { Prisma } from '@prisma/client';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';

export type ConversationAuthorizationContext = {
  conversationId: string;
  connectionId: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
  terminalOutcome: string | null;
  missionId: string | null;
};

export type ConversationAuthorizationErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'UNAUTHORIZED';

export class ConversationAuthorizationError extends Error {
  readonly code: ConversationAuthorizationErrorCode;

  constructor(code: ConversationAuthorizationErrorCode, message: string) {
    super(message);
    this.name = 'ConversationAuthorizationError';
    this.code = code;
  }
}

type LockedConversation = ConversationAuthorizationContext;

export async function authorizeConversationParticipant(
  transaction: Prisma.TransactionClient,
  actor: AuthorizationSubject,
  conversationId: string,
): Promise<ConversationAuthorizationContext> {
  const rows = await transaction.$queryRaw<LockedConversation[]>`
    SELECT
      conversation."id" AS "conversationId",
      connection."id" AS "connectionId",
      connection."customerId",
      connection."lifecycle",
      connection."terminalOutcome",
      mission."id" AS "missionId"
    FROM "Conversation" conversation
    INNER JOIN "Connection" connection ON connection."id" = conversation."connectionId"
    LEFT JOIN "Mission" mission ON mission."connectionId" = connection."id"
    WHERE conversation."id" = ${conversationId}
    FOR UPDATE OF connection
  `;
  const conversation = rows[0];
  if (!conversation) {
    throw new ConversationAuthorizationError(
      'CONVERSATION_NOT_FOUND',
      'The Conversation was not found.',
    );
  }

  const missionConversation =
    conversation.lifecycle === 'ENDED' &&
    conversation.terminalOutcome === 'MISSION_CREATED' &&
    Boolean(conversation.missionId);
  if (conversation.lifecycle !== 'CONNECTED' && !missionConversation) {
    throw new ConversationAuthorizationError(
      'CONNECTION_NOT_CONNECTED',
      'Conversation access is not available for this Connection state.',
    );
  }

  const customerAuthorization = canOperateAsCustomer(actor);
  const relaisAuthorization = canOperateAsRelais(actor);
  const actorRecord = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
  });
  let authorized = false;

  if (
    customerAuthorization.allowed &&
    actorRecord?.role === 'CUSTOMER' &&
    actorRecord.accountStatus === 'ACTIVE' &&
    conversation.customerId === actor.userId
  ) {
    authorized = true;
  }

  if (
    relaisAuthorization.allowed &&
    actorRecord?.role === 'RELAIS' &&
    actorRecord.accountStatus === 'ACTIVE' &&
    actorRecord.relaisProfile?.eligibility === 'APPROVED'
  ) {
    const assignment = conversation.missionId
      ? await transaction.missionAssignment.findFirst({
          where: { missionId: conversation.missionId, relaisUserId: actor.userId, endedAt: null },
          select: { id: true },
        })
      : await transaction.connectionAssignment.findFirst({
          where: { connectionId: conversation.connectionId, relaisUserId: actor.userId, endedAt: null },
          select: { id: true },
        });
    authorized = Boolean(assignment);
  }

  if (!authorized) {
    throw new ConversationAuthorizationError(
      'UNAUTHORIZED',
      'The actor is not an authorized participant in this Conversation.',
    );
  }

  return conversation;
}
