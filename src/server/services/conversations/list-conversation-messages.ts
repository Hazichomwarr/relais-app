import { prisma } from '../../db/client.ts';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';

export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

export type ListConversationMessagesInput = {
  actor: AuthorizationSubject;
  conversationId: string;
  cursor?: string | null;
  limit?: number;
};

export type ListConversationMessagesResult = {
  messages: Array<{
    id: string;
    conversationId: string;
    senderUserId: string;
    type: 'TEXT' | 'VOICE';
    text: string | null;
    createdAt: Date;
    voice: {
      storageKey: string;
      mimeType: string;
      byteSize: number;
      durationMs: number | null;
    } | null;
  }>;
  nextCursor: string | null;
};

export type ListConversationMessagesErrorCode =
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_CURSOR'
  | 'INVALID_LIMIT'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED';

export class ListConversationMessagesError extends Error {
  readonly code: ListConversationMessagesErrorCode;

  constructor(code: ListConversationMessagesErrorCode, message: string) {
    super(message);
    this.name = 'ListConversationMessagesError';
    this.code = code;
  }
}

type LockedConversation = {
  conversationId: string;
  connectionId: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
};

function getLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_MESSAGE_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MESSAGE_PAGE_SIZE) {
    throw new ListConversationMessagesError(
      'INVALID_LIMIT',
      `Limit must be an integer between 1 and ${MAX_MESSAGE_PAGE_SIZE}.`,
    );
  }
  return limit;
}

export async function listConversationMessages(
  input: ListConversationMessagesInput,
  client: PrismaClient = prisma,
): Promise<ListConversationMessagesResult> {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) {
    throw new ListConversationMessagesError('INVALID_CONVERSATION_ID', 'A Conversation id is required.');
  }
  const limit = getLimit(input.limit);
  if (input.cursor !== undefined && input.cursor !== null && !input.cursor.trim()) {
    throw new ListConversationMessagesError('INVALID_CURSOR', 'Cursor cannot be empty.');
  }

  const customerAuthorization = canOperateAsCustomer(input.actor);
  const relaisAuthorization = canOperateAsRelais(input.actor);
  if (!customerAuthorization.allowed && !relaisAuthorization.allowed) {
    throw new ListConversationMessagesError('UNAUTHORIZED', 'The actor is not authorized to read Conversation text.');
  }

  return client.$transaction(async (transaction) => {
    const conversations = await transaction.$queryRaw<LockedConversation[]>`
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
    const conversation = conversations[0];
    if (!conversation) {
      throw new ListConversationMessagesError('CONVERSATION_NOT_FOUND', 'The Conversation was not found.');
    }
    if (conversation.lifecycle !== 'CONNECTED') {
      throw new ListConversationMessagesError(
        'CONNECTION_NOT_CONNECTED',
        'Conversation text is available only for CONNECTED Connections.',
      );
    }

    const actorRecord = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
    });
    let authorized = false;
    if (
      actorRecord?.role === 'CUSTOMER' &&
      actorRecord.accountStatus === 'ACTIVE' &&
      conversation.customerId === input.actor.userId
    ) {
      authorized = customerAuthorization.allowed;
    }
    if (
      actorRecord?.role === 'RELAIS' &&
      actorRecord.accountStatus === 'ACTIVE' &&
      actorRecord.relaisProfile?.eligibility === 'APPROVED' &&
      relaisAuthorization.allowed
    ) {
      const assignment = await transaction.connectionAssignment.findFirst({
        where: { connectionId: conversation.connectionId, relaisUserId: input.actor.userId, endedAt: null },
        select: { id: true },
      });
      authorized = Boolean(assignment);
    }
    if (!authorized) {
      throw new ListConversationMessagesError('UNAUTHORIZED', 'The actor is not an authorized participant in this Conversation.');
    }

    const anchor = input.cursor
      ? await transaction.message.findFirst({
          where: { id: input.cursor, conversationId: input.conversationId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (input.cursor && !anchor) {
      throw new ListConversationMessagesError('INVALID_CURSOR', 'Cursor is not valid for this Conversation.');
    }

    const messages = await transaction.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(anchor
          ? {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { lt: anchor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        conversationId: true,
        senderUserId: true,
        type: true,
        text: true,
        createdAt: true,
        voiceAsset: {
          select: { storageKey: true, mimeType: true, byteSize: true, durationMs: true },
        },
      },
    });
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).reverse().map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      type: message.type,
      text: message.text,
      createdAt: message.createdAt,
      voice: message.voiceAsset,
    }));
    return {
      messages: page,
      nextCursor: hasMore && page[0] ? page[0].id : null,
    };
  }, { isolationLevel: 'Serializable' });
}
