import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import { authorizeConversationParticipant, ConversationAuthorizationError } from './conversation-authorization.ts';

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

  try {
    return await client.$transaction(async (transaction) => {
      const conversation = await authorizeConversationParticipant(
        transaction,
        input.actor,
        input.conversationId,
        { mode: 'read' },
      );

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
  } catch (error) {
    if (error instanceof ConversationAuthorizationError) {
      throw new ListConversationMessagesError(error.code, error.message);
    }
    throw error;
  }
}
