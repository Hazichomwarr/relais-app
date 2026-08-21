import { randomUUID } from 'node:crypto';

export const VOICE_MIME_TYPES = [
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm',
] as const;

export type VoiceMimeType = (typeof VOICE_MIME_TYPES)[number];

export type VoiceUploadContext = {
  conversationId: string;
  senderUserId: string;
  clientMessageId: string;
  mimeType: VoiceMimeType;
  byteSize?: number;
};

export type VoiceUploadGrant = {
  uploadToken: string;
  storageKey: string;
  expiresAt: Date;
};

export type StoredVoiceObject = {
  storageKey: string;
  mimeType: VoiceMimeType;
  byteSize: number;
};

export type VoiceReadReference = {
  reference: string;
  expiresAt: Date;
};

export interface VoiceStorage {
  createUpload(context: VoiceUploadContext): Promise<VoiceUploadGrant>;
  finalizeUpload(input: {
    uploadToken: string;
    conversationId: string;
    senderUserId: string;
    clientMessageId: string;
  }): Promise<StoredVoiceObject>;
  deleteObject(storageKey: string): Promise<void>;
  getAuthorizedReadReference(storageKey: string): Promise<VoiceReadReference>;
}

export class VoiceStorageError extends Error {
  readonly code: 'UPLOAD_NOT_FOUND' | 'UPLOAD_NOT_READY' | 'STORAGE_NOT_CONFIGURED';

  constructor(
    code: 'UPLOAD_NOT_FOUND' | 'UPLOAD_NOT_READY' | 'STORAGE_NOT_CONFIGURED',
    message: string,
  ) {
    super(message);
    this.name = 'VoiceStorageError';
    this.code = code;
  }
}

class UnconfiguredVoiceStorage implements VoiceStorage {
  async createUpload(): Promise<VoiceUploadGrant> {
    throw new VoiceStorageError('STORAGE_NOT_CONFIGURED', 'Voice storage has not been configured.');
  }

  async finalizeUpload(): Promise<StoredVoiceObject> {
    throw new VoiceStorageError('STORAGE_NOT_CONFIGURED', 'Voice storage has not been configured.');
  }

  async deleteObject(): Promise<void> {
    throw new VoiceStorageError('STORAGE_NOT_CONFIGURED', 'Voice storage has not been configured.');
  }

  async getAuthorizedReadReference(): Promise<VoiceReadReference> {
    throw new VoiceStorageError('STORAGE_NOT_CONFIGURED', 'Voice storage has not been configured.');
  }
}

export const voiceStorage: VoiceStorage = new UnconfiguredVoiceStorage();

type InMemoryUpload = {
  context: VoiceUploadContext;
  grant: VoiceUploadGrant;
  object?: StoredVoiceObject;
};

export class InMemoryVoiceStorage implements VoiceStorage {
  private readonly uploads = new Map<string, InMemoryUpload>();

  async createUpload(context: VoiceUploadContext): Promise<VoiceUploadGrant> {
    const uploadToken = `memory-upload-${randomUUID()}`;
    const grant = {
      uploadToken,
      storageKey: `voice/${context.conversationId}/${randomUUID()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    this.uploads.set(uploadToken, { context, grant });
    return grant;
  }

  putUpload(uploadToken: string, object: StoredVoiceObject): void {
    const upload = this.uploads.get(uploadToken);
    if (!upload) throw new VoiceStorageError('UPLOAD_NOT_FOUND', 'The upload was not found.');
    upload.object = object;
  }

  async finalizeUpload(input: {
    uploadToken: string;
    conversationId: string;
    senderUserId: string;
    clientMessageId: string;
  }): Promise<StoredVoiceObject> {
    const upload = this.uploads.get(input.uploadToken);
    if (!upload) throw new VoiceStorageError('UPLOAD_NOT_FOUND', 'The upload was not found.');
    if (
      upload.context.conversationId !== input.conversationId ||
      upload.context.senderUserId !== input.senderUserId ||
      upload.context.clientMessageId !== input.clientMessageId
    ) {
      throw new VoiceStorageError('UPLOAD_NOT_FOUND', 'The upload does not belong to this message request.');
    }
    if (!upload.object) throw new VoiceStorageError('UPLOAD_NOT_READY', 'The upload is not ready for finalization.');
    return upload.object;
  }

  async deleteObject(storageKey: string): Promise<void> {
    for (const [token, upload] of this.uploads) {
      if (upload.grant.storageKey === storageKey) this.uploads.delete(token);
    }
  }

  async getAuthorizedReadReference(storageKey: string): Promise<VoiceReadReference> {
    const exists = [...this.uploads.values()].some((upload) => upload.object?.storageKey === storageKey);
    if (!exists) throw new VoiceStorageError('UPLOAD_NOT_FOUND', 'The voice object was not found.');
    return { reference: `memory://voice/${storageKey}`, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
  }
}
