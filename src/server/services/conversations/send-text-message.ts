import { prisma } from '../../db/client.ts';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';

export const MAX_TEXT_MESSAGE_LENGTH = 4000;
export const MAX_CLIENT_MESSAGE_ID_LENGTH = 128;

export type SendTextMessageInput = {
  actor: AuthorizationSubject;
  conversationId: string;
  text: string;
  clientMessageId: string;
};

export type TextMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: 'TEXT';
  text: string;
  createdAt: Date;
};

export type TextMessageResult = {
  status: 'CREATED' | 'EXISTING';
  message: TextMessage;
};

export type SendTextMessageErrorCode =
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_TEXT'
  | 'TEXT_TOO_LONG'
  | 'INVALID_CLIENT_MESSAGE_ID'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'IDEMPOTENCY_CONFLICT';

export class SendTextMessageError extends Error {
  readonly code: SendTextMessageErrorCode;

  constructor(code: SendTextMessageErrorCode, message: string) {
    super(message);
    this.name = 'SendTextMessageError';
    this.code = code;
  }
}

type LockedConversation = {
  conversationId: string;
  connectionId: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
};

function validateInput(input: SendTextMessageInput): void {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) {
    throw new SendTextMessageError('INVALID_CONVERSATION_ID', 'A Conversation id is required.');
  }
  if (typeof input.text !== 'string' || !input.text.trim()) {
    throw new SendTextMessageError('INVALID_TEXT', 'Message text cannot be empty.');
  }
  if (input.text.length > MAX_TEXT_MESSAGE_LENGTH) {
    throw new SendTextMessageError(
      'TEXT_TOO_LONG',
      `Message text cannot exceed ${MAX_TEXT_MESSAGE_LENGTH} characters.`,
    );
  }
  if (
    typeof input.clientMessageId !== 'string' ||
    !input.clientMessageId.trim() ||
    input.clientMessageId.length > MAX_CLIENT_MESSAGE_ID_LENGTH
  ) {
    throw new SendTextMessageError(
      'INVALID_CLIENT_MESSAGE_ID',
      `Client message id must be between 1 and ${MAX_CLIENT_MESSAGE_ID_LENGTH} characters.`,
    );
  }
}

export async function sendTextMessage(
  input: SendTextMessageInput,
  client: PrismaClient = prisma,
): Promise<TextMessageResult> {
  validateInput(input);

  const customerAuthorization = canOperateAsCustomer(input.actor);
  const relaisAuthorization = canOperateAsRelais(input.actor);
  if (!customerAuthorization.allowed && !relaisAuthorization.allowed) {
    throw new SendTextMessageError('UNAUTHORIZED', 'The actor is not authorized to send Conversation text.');
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
      throw new SendTextMessageError('CONVERSATION_NOT_FOUND', 'The Conversation was not found.');
    }
    if (conversation.lifecycle !== 'CONNECTED') {
      throw new SendTextMessageError(
        'CONNECTION_NOT_CONNECTED',
        'Text messages require a CONNECTED Connection.',
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
      throw new SendTextMessageError(
        'UNAUTHORIZED',
        'The actor is not an authorized participant in this Conversation.',
      );
    }

    const existing = await transaction.message.findFirst({
      where: {
        conversationId: input.conversationId,
        senderUserId: input.actor.userId,
        clientMessageId: input.clientMessageId,
      },
      select: { id: true, conversationId: true, senderUserId: true, type: true, text: true, createdAt: true },
    });
    if (existing) {
      if (existing.type !== 'TEXT' || existing.text !== input.text) {
        throw new SendTextMessageError(
          'IDEMPOTENCY_CONFLICT',
          'The client message id was already used with different content.',
        );
      }
      return { status: 'EXISTING', message: { ...existing, type: 'TEXT' } };
    }

    const message = await transaction.message.create({
      data: {
        conversationId: input.conversationId,
        senderUserId: input.actor.userId,
        type: 'TEXT',
        text: input.text,
        clientMessageId: input.clientMessageId,
      },
      select: { id: true, conversationId: true, senderUserId: true, type: true, text: true, createdAt: true },
    });
    return { status: 'CREATED', message: { ...message, type: 'TEXT' } };
  }, { isolationLevel: 'Serializable' });
}
