import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('voice Conversation database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [
    { PrismaPg },
    { PrismaClient },
    { InMemoryVoiceStorage },
    { prepareVoiceMessageUpload, PrepareVoiceMessageUploadError, MAX_VOICE_BYTE_SIZE, MAX_VOICE_DURATION_MS },
    { finalizeVoiceMessage, FinalizeVoiceMessageError },
    { getVoiceMessagePlayback, GetVoiceMessagePlaybackError },
    { sendTextMessage },
    { listConversationMessages },
    { cancelConnection },
  ] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('../../storage/voice-storage.ts'),
    import('./prepare-voice-message-upload.ts'),
    import('./finalize-voice-message.ts'),
    import('./get-voice-message-playback.ts'),
    import('./send-text-message.ts'),
    import('./list-conversation-messages.ts'),
    import('../connections/cancel-connection.ts'),
  ]);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];

  const createCustomer = async ({ accountStatus = 'ACTIVE' } = {}) => {
    const user = await prisma.user.create({ data: { role: 'CUSTOMER', accountStatus, customerProfile: { create: {} } } });
    userIds.push(user.id);
    return user;
  };

  const createRelais = async ({ accountStatus = 'ACTIVE', eligibility = 'APPROVED', availability = 'AVAILABLE' } = {}) => {
    const user = await prisma.user.create({ data: { role: 'RELAIS', accountStatus, relaisProfile: { create: { eligibility, availability } } } });
    userIds.push(user.id);
    return user;
  };

  const createFixture = async () => {
    const customer = await createCustomer();
    const relais = await createRelais();
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `voice-test-${connectionIds.length}-${customer.id}` } });
    connectionIds.push(connection.id);
    const assignment = await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    const conversation = await prisma.conversation.create({ data: { connectionId: connection.id } });
    await prisma.connection.update({ where: { id: connection.id }, data: { lifecycle: 'CONNECTED', connectedAt: new Date('2026-08-21T15:00:00.000Z') } });
    return { customer, relais, connection, assignment, conversation };
  };

  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user, eligibility = 'APPROVED') => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: eligibility });

  const prepare = async (fixture, storage, overrides = {}) => {
    const result = await prepareVoiceMessageUpload({
      actor: overrides.actor ?? customerActor(fixture.customer),
      conversationId: fixture.conversation.id,
      clientMessageId: overrides.clientMessageId ?? `voice-${fixture.connection.id}`,
      mimeType: overrides.mimeType ?? 'audio/m4a',
      byteSize: overrides.byteSize ?? 1024,
    }, prisma, storage);
    storage.putUpload(result.uploadToken, {
      storageKey: result.storageKey,
      mimeType: overrides.objectMimeType ?? overrides.mimeType ?? 'audio/m4a',
      byteSize: overrides.objectByteSize ?? overrides.byteSize ?? 1024,
    });
    return result;
  };

  const expectError = async (promise, ErrorClass, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ErrorClass);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('Customer and assigned Relais can prepare and finalize immutable voice messages', async () => {
    try {
      const fixture = await createFixture();
      const storage = new InMemoryVoiceStorage();
      const upload = await prepare(fixture, storage, { clientMessageId: 'customer-voice' });
      const customerVoice = await finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'customer-voice', uploadTokenOrKey: upload.uploadToken, durationMs: 4200 }, prisma, storage);
      assert.equal(customerVoice.status, 'CREATED');
      assert.equal(customerVoice.message.type, 'VOICE');
      assert.equal(customerVoice.message.senderUserId, fixture.customer.id);
      assert.equal(customerVoice.message.voice.mimeType, 'audio/m4a');
      assert.equal(customerVoice.message.voice.byteSize, 1024);
      assert.equal(customerVoice.message.voice.durationMs, 4200);

      const relaisUpload = await prepareVoiceMessageUpload({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, clientMessageId: 'relais-voice', mimeType: 'audio/mp4', byteSize: 2048 }, prisma, storage);
      storage.putUpload(relaisUpload.uploadToken, { storageKey: relaisUpload.storageKey, mimeType: 'audio/mp4', byteSize: 2048 });
      const relaisVoice = await finalizeVoiceMessage({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, clientMessageId: 'relais-voice', uploadTokenOrKey: relaisUpload.uploadToken, durationMs: 8000 }, prisma, storage);
      assert.equal(relaisVoice.message.senderUserId, fixture.relais.id);
      assert.equal(await prisma.voiceMessageAsset.count({ where: { messageId: customerVoice.message.id } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('invalid MIME, size, duration, and missing uploads are rejected without Messages', async () => {
    try {
      const fixture = await createFixture();
      const storage = new InMemoryVoiceStorage();
      await expectError(prepareVoiceMessageUpload({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'pdf', mimeType: 'application/pdf' }, prisma, storage), PrepareVoiceMessageUploadError, 'INVALID_MIME_TYPE');
      await expectError(prepareVoiceMessageUpload({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'large', mimeType: 'audio/m4a', byteSize: MAX_VOICE_BYTE_SIZE + 1 }, prisma, storage), PrepareVoiceMessageUploadError, 'VOICE_TOO_LARGE');
      const upload = await prepare(fixture, storage, { clientMessageId: 'invalid-finalize' });
      await expectError(finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'invalid-finalize', uploadTokenOrKey: upload.uploadToken, durationMs: MAX_VOICE_DURATION_MS + 1 }, prisma, storage), FinalizeVoiceMessageError, 'VOICE_TOO_LONG');
      await expectError(finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'missing-upload', uploadTokenOrKey: 'missing-token' }, prisma, storage), FinalizeVoiceMessageError, 'UPLOAD_NOT_FOUND');
      assert.equal(await prisma.message.count({ where: { conversationId: fixture.conversation.id } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('former Relais and terminal Connections fail finalization after preparation', async () => {
    try {
      const fixture = await createFixture();
      const replacement = await createRelais();
      const storage = new InMemoryVoiceStorage();
      const upload = await prepare(fixture, storage, { actor: relaisActor(fixture.relais), clientMessageId: 'reassignment' });
      await prisma.connectionAssignment.update({ where: { id: fixture.assignment.id }, data: { endedAt: new Date() } });
      await prisma.connectionAssignment.create({ data: { connectionId: fixture.connection.id, relaisUserId: replacement.id } });
      await expectError(finalizeVoiceMessage({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, clientMessageId: 'reassignment', uploadTokenOrKey: upload.uploadToken }, prisma, storage), FinalizeVoiceMessageError, 'UNAUTHORIZED');

      const terminalFixture = await createFixture();
      const terminalUpload = await prepare(terminalFixture, storage, { clientMessageId: 'terminal-upload' });
      await cancelConnection({ actor: customerActor(terminalFixture.customer), connectionId: terminalFixture.connection.id }, prisma);
      await expectError(finalizeVoiceMessage({ actor: customerActor(terminalFixture.customer), conversationId: terminalFixture.conversation.id, clientMessageId: 'terminal-upload', uploadTokenOrKey: terminalUpload.uploadToken }, prisma, storage), FinalizeVoiceMessageError, 'CONNECTION_NOT_CONNECTED');
    } finally {
      await cleanup();
    }
  });

  test('voice idempotency is retry-safe and conflicts with text or another object', async () => {
    try {
      const fixture = await createFixture();
      const storage = new InMemoryVoiceStorage();
      const upload = await prepare(fixture, storage, { clientMessageId: 'same-voice' });
      const input = { actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'same-voice', uploadTokenOrKey: upload.uploadToken, durationMs: 1000 };
      const first = await finalizeVoiceMessage(input, prisma, storage);
      const retry = await finalizeVoiceMessage(input, prisma, storage);
      assert.equal(retry.status, 'EXISTING');
      assert.equal(retry.message.id, first.message.id);

      const otherUpload = await prepare(fixture, storage, { clientMessageId: 'same-voice', byteSize: 2048 });
      await expectError(finalizeVoiceMessage({ ...input, uploadTokenOrKey: otherUpload.uploadToken }, prisma, storage), FinalizeVoiceMessageError, 'IDEMPOTENCY_CONFLICT');

      const text = await sendTextMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'Text key', clientMessageId: 'text-key' }, prisma);
      const voiceKeyUpload = await prepare(fixture, storage, { clientMessageId: 'text-key' });
      await expectError(finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'text-key', uploadTokenOrKey: voiceKeyUpload.uploadToken }, prisma, storage), FinalizeVoiceMessageError, 'IDEMPOTENCY_CONFLICT');
      assert.equal(await prisma.message.count({ where: { id: text.message.id } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('concurrent finalization creates one Message and one asset', async () => {
    try {
      const fixture = await createFixture();
      const storage = new InMemoryVoiceStorage();
      const upload = await prepare(fixture, storage, { clientMessageId: 'concurrent-voice' });
      const input = { actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'concurrent-voice', uploadTokenOrKey: upload.uploadToken, durationMs: 3000 };
      const results = await Promise.all([finalizeVoiceMessage(input, prisma, storage), finalizeVoiceMessage(input, prisma, storage)]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['CREATED', 'EXISTING']);
      assert.equal(await prisma.message.count({ where: { conversationId: fixture.conversation.id } }), 1);
      assert.equal(await prisma.voiceMessageAsset.count({ where: { message: { conversationId: fixture.conversation.id } } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('playback is authorization-scoped and mixed TEXT/VOICE history remains paginated', async () => {
    try {
      const fixture = await createFixture();
      const other = await createCustomer();
      const storage = new InMemoryVoiceStorage();
      await sendTextMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'Before voice', clientMessageId: 'text-before' }, prisma);
      const upload = await prepare(fixture, storage, { clientMessageId: 'voice-history' });
      const voice = await finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'voice-history', uploadTokenOrKey: upload.uploadToken, durationMs: 2500 }, prisma, storage);
      const history = await listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, limit: 10 }, prisma);
      assert.deepEqual(history.messages.map((message) => message.type), ['TEXT', 'VOICE']);
      assert.equal(history.messages[1].voice?.durationMs, 2500);
      const playback = await getVoiceMessagePlayback({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, messageId: voice.message.id }, prisma, storage);
      assert.match(playback.reference, /^memory:\/\//);
      assert.ok(playback.expiresAt instanceof Date);
      await expectError(getVoiceMessagePlayback({ actor: customerActor(other), conversationId: fixture.conversation.id, messageId: voice.message.id }, prisma, storage), GetVoiceMessagePlaybackError, 'UNAUTHORIZED');
    } finally {
      await cleanup();
    }
  });

  test('unavailable assigned Relais can communicate, while revoked Relais cannot', async () => {
    try {
      const fixture = await createFixture();
      const storage = new InMemoryVoiceStorage();
      await prisma.relaisProfile.update({ where: { userId: fixture.relais.id }, data: { availability: 'UNAVAILABLE' } });
      const upload = await prepareVoiceMessageUpload({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, clientMessageId: 'unavailable-relais', mimeType: 'audio/m4a' }, prisma, storage);
      storage.putUpload(upload.uploadToken, { storageKey: upload.storageKey, mimeType: 'audio/m4a', byteSize: 512 });
      const result = await finalizeVoiceMessage({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, clientMessageId: 'unavailable-relais', uploadTokenOrKey: upload.uploadToken }, prisma, storage);
      assert.equal(result.status, 'CREATED');
      await prisma.relaisProfile.update({ where: { userId: fixture.relais.id }, data: { eligibility: 'REVOKED' } });
      await expectError(prepareVoiceMessageUpload({ actor: relaisActor(fixture.relais, 'REVOKED'), conversationId: fixture.conversation.id, clientMessageId: 'revoked-relais', mimeType: 'audio/m4a' }, prisma, storage), PrepareVoiceMessageUploadError, 'UNAUTHORIZED');
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.voiceMessageAsset.deleteMany({ where: { message: { conversation: { connectionId: { in: connectionIds } } } } });
      await prisma.message.deleteMany({ where: { conversation: { connectionId: { in: connectionIds } } } });
      await prisma.connectionAssignment.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.conversation.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.connection.deleteMany({ where: { id: { in: connectionIds } } });
    }
    if (userIds.length) {
      await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.relaisProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    connectionIds.length = 0;
    userIds.length = 0;
  }

  test.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
}
