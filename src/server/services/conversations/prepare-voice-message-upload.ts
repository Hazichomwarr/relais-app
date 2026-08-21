import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import {
  VOICE_MIME_TYPES,
  voiceStorage,
  type VoiceMimeType,
  type VoiceStorage,
  type VoiceUploadGrant,
} from '../../storage/voice-storage.ts';
import {
  authorizeVoiceConversation,
  VoiceConversationAuthorizationError,
} from './voice-conversation-authorization.ts';

export const MAX_VOICE_BYTE_SIZE = 10 * 1024 * 1024;
export const MAX_VOICE_DURATION_MS = 5 * 60 * 1000;

export type PrepareVoiceMessageUploadInput = {
  actor: AuthorizationSubject;
  conversationId: string;
  clientMessageId: string;
  mimeType: string;
  byteSize?: number;
};

export type PrepareVoiceMessageUploadResult = VoiceUploadGrant & {
  status: 'PREPARED';
  maxByteSize: number;
  maxDurationMs: number;
};

export type PrepareVoiceMessageUploadErrorCode =
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_CLIENT_MESSAGE_ID'
  | 'INVALID_MIME_TYPE'
  | 'VOICE_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONNECTION_NOT_CONNECTED'
  | 'STORAGE_NOT_CONFIGURED';

export class PrepareVoiceMessageUploadError extends Error {
  readonly code: PrepareVoiceMessageUploadErrorCode;

  constructor(code: PrepareVoiceMessageUploadErrorCode, message: string) {
    super(message);
    this.name = 'PrepareVoiceMessageUploadError';
    this.code = code;
  }
}

function validateInput(input: PrepareVoiceMessageUploadInput): VoiceMimeType {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) {
    throw new PrepareVoiceMessageUploadError('INVALID_CONVERSATION_ID', 'A Conversation id is required.');
  }
  if (
    typeof input.clientMessageId !== 'string' ||
    !input.clientMessageId.trim() ||
    input.clientMessageId.length > 128
  ) {
    throw new PrepareVoiceMessageUploadError('INVALID_CLIENT_MESSAGE_ID', 'A valid client message id is required.');
  }
  if (!(VOICE_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new PrepareVoiceMessageUploadError('INVALID_MIME_TYPE', 'The voice MIME type is not supported.');
  }
  if (input.byteSize !== undefined && (!Number.isInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > MAX_VOICE_BYTE_SIZE)) {
    throw new PrepareVoiceMessageUploadError('VOICE_TOO_LARGE', `Voice messages cannot exceed ${MAX_VOICE_BYTE_SIZE} bytes.`);
  }
  return input.mimeType as VoiceMimeType;
}

export async function prepareVoiceMessageUpload(
  input: PrepareVoiceMessageUploadInput,
  client: PrismaClient = prisma,
  storage: VoiceStorage = voiceStorage,
): Promise<PrepareVoiceMessageUploadResult> {
  const mimeType = validateInput(input);
  try {
    const grant = await client.$transaction(async (transaction) => {
      const context = await authorizeVoiceConversation(transaction, input.actor, input.conversationId);
      return storage.createUpload({
        conversationId: context.conversationId,
        senderUserId: input.actor.userId,
        clientMessageId: input.clientMessageId,
        mimeType,
        byteSize: input.byteSize,
      });
    }, { isolationLevel: 'Serializable' });
    return { ...grant, status: 'PREPARED', maxByteSize: MAX_VOICE_BYTE_SIZE, maxDurationMs: MAX_VOICE_DURATION_MS };
  } catch (error) {
    if (error instanceof VoiceConversationAuthorizationError) {
      throw new PrepareVoiceMessageUploadError(error.code, error.message);
    }
    if (error instanceof Error && error.name === 'VoiceStorageError' && 'code' in error && error.code === 'STORAGE_NOT_CONFIGURED') {
      throw new PrepareVoiceMessageUploadError('STORAGE_NOT_CONFIGURED', error.message);
    }
    throw error;
  }
}
