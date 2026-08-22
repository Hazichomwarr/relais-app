import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import {
  MAX_VOICE_BYTE_SIZE,
  MAX_VOICE_DURATION_MS,
} from './prepare-voice-message-upload.ts';
import {
  voiceStorage,
  VoiceStorageError,
  type VoiceStorage,
} from '../../storage/voice-storage.ts';
import {
  authorizeVoiceConversation,
  VoiceConversationAuthorizationError,
} from './voice-conversation-authorization.ts';

export type FinalizeVoiceMessageInput = {
  actor: AuthorizationSubject;
  conversationId: string;
  clientMessageId: string;
  uploadTokenOrKey: string;
  durationMs?: number | null;
};

export type FinalizeVoiceMessageResult = {
  status: 'CREATED' | 'EXISTING';
  message: {
    id: string;
    conversationId: string;
    senderUserId: string;
    type: 'VOICE';
    text: null;
    createdAt: Date;
    voice: {
      storageKey: string;
      mimeType: string;
      byteSize: number;
      durationMs: number | null;
    };
  };
};

export type FinalizeVoiceMessageErrorCode =
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_CLIENT_MESSAGE_ID'
  | 'INVALID_DURATION'
  | 'VOICE_TOO_LONG'
  | 'VOICE_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'UPLOAD_NOT_FOUND'
  | 'UPLOAD_NOT_READY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_MIME_TYPE';

export class FinalizeVoiceMessageError extends Error {
  readonly code: FinalizeVoiceMessageErrorCode;

  constructor(code: FinalizeVoiceMessageErrorCode, message: string) {
    super(message);
    this.name = 'FinalizeVoiceMessageError';
    this.code = code;
  }
}

function validateInput(input: FinalizeVoiceMessageInput): void {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) {
    throw new FinalizeVoiceMessageError('INVALID_CONVERSATION_ID', 'A Conversation id is required.');
  }
  if (typeof input.clientMessageId !== 'string' || !input.clientMessageId.trim() || input.clientMessageId.length > 128) {
    throw new FinalizeVoiceMessageError('INVALID_CLIENT_MESSAGE_ID', 'A valid client message id is required.');
  }
  if (typeof input.uploadTokenOrKey !== 'string' || !input.uploadTokenOrKey.trim()) {
    throw new FinalizeVoiceMessageError('UPLOAD_NOT_FOUND', 'An upload token is required.');
  }
  if (input.durationMs !== undefined && input.durationMs !== null && (!Number.isInteger(input.durationMs) || input.durationMs < 1)) {
    throw new FinalizeVoiceMessageError('INVALID_DURATION', 'Voice duration must be a positive integer.');
  }
  if (input.durationMs !== undefined && input.durationMs !== null && input.durationMs > MAX_VOICE_DURATION_MS) {
    throw new FinalizeVoiceMessageError('VOICE_TOO_LONG', `Voice messages cannot exceed ${MAX_VOICE_DURATION_MS}ms.`);
  }
}

function mapStorageError(error: unknown): FinalizeVoiceMessageError | null {
  if (!(error instanceof VoiceStorageError)) return null;
  if (error.code === 'UPLOAD_NOT_READY') return new FinalizeVoiceMessageError('UPLOAD_NOT_READY', error.message);
  if (error.code === 'UPLOAD_NOT_FOUND') return new FinalizeVoiceMessageError('UPLOAD_NOT_FOUND', error.message);
  return new FinalizeVoiceMessageError('UPLOAD_NOT_FOUND', error.message);
}

function isRetryableFinalizationConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034' || error.code === '40001')) ||
    message.includes('40001') || message.includes('could not serialize access') ||
    message.includes('TransactionWriteConflict') || message.includes('write conflict') ||
    message.includes('deadlock');
}

export async function finalizeVoiceMessage(
  input: FinalizeVoiceMessageInput,
  client: PrismaClient = prisma,
  storage: VoiceStorage = voiceStorage,
): Promise<FinalizeVoiceMessageResult> {
  validateInput(input);

  try {
    await client.$transaction(async (transaction) => {
      await authorizeVoiceConversation(transaction, input.actor, input.conversationId);
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof VoiceConversationAuthorizationError) {
      throw new FinalizeVoiceMessageError(error.code, error.message);
    }
    throw error;
  }

  let storedObject;
  try {
    storedObject = await storage.finalizeUpload({
      uploadToken: input.uploadTokenOrKey,
      conversationId: input.conversationId,
      senderUserId: input.actor.userId,
      clientMessageId: input.clientMessageId,
    });
  } catch (error) {
    const mapped = mapStorageError(error);
    if (mapped) throw mapped;
    throw error;
  }

  if (storedObject.byteSize < 1 || storedObject.byteSize > MAX_VOICE_BYTE_SIZE) {
    throw new FinalizeVoiceMessageError('VOICE_TOO_LARGE', `Voice messages cannot exceed ${MAX_VOICE_BYTE_SIZE} bytes.`);
  }
  if (input.durationMs !== undefined && input.durationMs !== null && input.durationMs > MAX_VOICE_DURATION_MS) {
    throw new FinalizeVoiceMessageError('VOICE_TOO_LONG', `Voice messages cannot exceed ${MAX_VOICE_DURATION_MS}ms.`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(async (transaction) => {
      const context = await authorizeVoiceConversation(transaction, input.actor, input.conversationId);
      const existing = await transaction.message.findFirst({
        where: {
          conversationId: context.conversationId,
          senderUserId: input.actor.userId,
          clientMessageId: input.clientMessageId,
        },
        include: { voiceAsset: true },
      });
      if (existing) {
        if (existing.type !== 'VOICE' || !existing.voiceAsset) {
          throw new FinalizeVoiceMessageError('IDEMPOTENCY_CONFLICT', 'The client message id belongs to a different message payload.');
        }
        const samePayload =
          existing.voiceAsset.storageKey === storedObject.storageKey &&
          existing.voiceAsset.mimeType === storedObject.mimeType &&
          existing.voiceAsset.byteSize === storedObject.byteSize &&
          existing.voiceAsset.durationMs === (input.durationMs ?? null);
        if (!samePayload) {
          throw new FinalizeVoiceMessageError('IDEMPOTENCY_CONFLICT', 'The client message id was already used with a different voice object.');
        }
        return {
          status: 'EXISTING' as const,
          message: {
            id: existing.id,
            conversationId: existing.conversationId,
            senderUserId: existing.senderUserId,
            type: 'VOICE' as const,
            text: null,
            createdAt: existing.createdAt,
            voice: {
              storageKey: existing.voiceAsset.storageKey,
              mimeType: existing.voiceAsset.mimeType,
              byteSize: existing.voiceAsset.byteSize,
              durationMs: existing.voiceAsset.durationMs,
            },
          },
        };
      }

      const message = await transaction.message.create({
        data: {
          conversationId: context.conversationId,
          senderUserId: input.actor.userId,
          type: 'VOICE',
          text: null,
          clientMessageId: input.clientMessageId,
          voiceAsset: {
            create: {
              storageKey: storedObject.storageKey,
              mimeType: storedObject.mimeType,
              byteSize: storedObject.byteSize,
              durationMs: input.durationMs ?? null,
            },
          },
        },
        include: { voiceAsset: true },
      });
      if (!message.voiceAsset) throw new FinalizeVoiceMessageError('IDEMPOTENCY_CONFLICT', 'Voice asset creation failed.');
      return {
        status: 'CREATED' as const,
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderUserId: message.senderUserId,
          type: 'VOICE' as const,
          text: null,
          createdAt: message.createdAt,
          voice: {
            storageKey: message.voiceAsset.storageKey,
            mimeType: message.voiceAsset.mimeType,
            byteSize: message.voiceAsset.byteSize,
            durationMs: message.voiceAsset.durationMs,
          },
        },
      };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof VoiceConversationAuthorizationError) {
        throw new FinalizeVoiceMessageError(error.code, error.message);
      }
      if (isRetryableFinalizationConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Voice message finalization could not complete safely.');
}
