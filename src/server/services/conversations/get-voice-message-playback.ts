import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import { voiceStorage, VoiceStorageError, type VoiceStorage } from '../../storage/voice-storage.ts';
import { authorizeVoiceConversation, VoiceConversationAuthorizationError } from './voice-conversation-authorization.ts';

export type GetVoiceMessagePlaybackInput = {
  actor: AuthorizationSubject;
  conversationId: string;
  messageId: string;
};

export type GetVoiceMessagePlaybackResult = {
  messageId: string;
  reference: string;
  expiresAt: Date;
  mimeType: string;
  durationMs: number | null;
};

export type GetVoiceMessagePlaybackErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'UNAUTHORIZED'
  | 'VOICE_MESSAGE_NOT_FOUND'
  | 'UPLOAD_NOT_FOUND';

export class GetVoiceMessagePlaybackError extends Error {
  readonly code: GetVoiceMessagePlaybackErrorCode;

  constructor(code: GetVoiceMessagePlaybackErrorCode, message: string) {
    super(message);
    this.name = 'GetVoiceMessagePlaybackError';
    this.code = code;
  }
}

export async function getVoiceMessagePlayback(
  input: GetVoiceMessagePlaybackInput,
  client: PrismaClient = prisma,
  storage: VoiceStorage = voiceStorage,
): Promise<GetVoiceMessagePlaybackResult> {
  try {
    const result = await client.$transaction(async (transaction) => {
      const context = await authorizeVoiceConversation(transaction, input.actor, input.conversationId);
      const message = await transaction.message.findFirst({
        where: { id: input.messageId, conversationId: context.conversationId, type: 'VOICE' },
        include: { voiceAsset: true },
      });
      if (!message?.voiceAsset) {
        throw new GetVoiceMessagePlaybackError('VOICE_MESSAGE_NOT_FOUND', 'The voice message was not found.');
      }
      return {
        messageId: message.id,
        storageKey: message.voiceAsset.storageKey,
        mimeType: message.voiceAsset.mimeType,
        durationMs: message.voiceAsset.durationMs,
      };
    }, { isolationLevel: 'Serializable' });
    try {
      const reference = await storage.getAuthorizedReadReference(result.storageKey);
      return { ...result, reference: reference.reference, expiresAt: reference.expiresAt };
    } catch (error) {
      if (error instanceof VoiceStorageError) {
        throw new GetVoiceMessagePlaybackError('UPLOAD_NOT_FOUND', error.message);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof VoiceConversationAuthorizationError) {
      throw new GetVoiceMessagePlaybackError(error.code, error.message);
    }
    throw error;
  }
}
