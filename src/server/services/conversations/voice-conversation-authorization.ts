import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { Prisma } from '@prisma/client';

export type VoiceConversationContext = {
  conversationId: string;
  connectionId: string;
  customerId: string;
};

export type VoiceConversationAuthorizationErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'UNAUTHORIZED';

export class VoiceConversationAuthorizationError extends Error {
  readonly code: VoiceConversationAuthorizationErrorCode;

  constructor(code: VoiceConversationAuthorizationErrorCode, message: string) {
    super(message);
    this.name = 'VoiceConversationAuthorizationError';
    this.code = code;
  }
}

type LockedConversation = VoiceConversationContext & {
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
};

export async function authorizeVoiceConversation(
  transaction: Prisma.TransactionClient,
  actor: AuthorizationSubject,
  conversationId: string,
): Promise<VoiceConversationContext> {
  const rows = await transaction.$queryRaw<LockedConversation[]>`
    SELECT
      conversation."id" AS "conversationId",
      connection."id" AS "connectionId",
      connection."customerId",
      connection."lifecycle"
    FROM "Conversation" conversation
    INNER JOIN "Connection" connection ON connection."id" = conversation."connectionId"
    WHERE conversation."id" = ${conversationId}
    FOR UPDATE OF connection
  `;
  const conversation = rows[0];
  if (!conversation) {
    throw new VoiceConversationAuthorizationError(
      'CONVERSATION_NOT_FOUND',
      'The Conversation was not found.',
    );
  }
  if (conversation.lifecycle !== 'CONNECTED') {
    throw new VoiceConversationAuthorizationError(
      'CONNECTION_NOT_CONNECTED',
      'Voice messages require a CONNECTED Connection.',
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
    const assignment = await transaction.connectionAssignment.findFirst({
      where: { connectionId: conversation.connectionId, relaisUserId: actor.userId, endedAt: null },
      select: { id: true },
    });
    authorized = Boolean(assignment);
  }

  if (!authorized) {
    throw new VoiceConversationAuthorizationError(
      'UNAUTHORIZED',
      'The actor is not an authorized participant in this Conversation.',
    );
  }

  return {
    conversationId: conversation.conversationId,
    connectionId: conversation.connectionId,
    customerId: conversation.customerId,
  };
}
