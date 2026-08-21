import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('QUICK Offer response database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [
    { PrismaPg },
    { PrismaClient },
    acceptService,
    rejectService,
    createService,
    textService,
    callService,
    voiceUploadService,
    voiceFinalizeService,
    { InMemoryVoiceStorage },
    { cancelConnection },
  ] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./accept-quick-offer.ts'),
    import('./reject-quick-offer.ts'),
    import('./create-quick-offer.ts'),
    import('../conversations/send-text-message.ts'),
    import('../conversations/prepare-native-call-handoff.ts'),
    import('../conversations/prepare-voice-message-upload.ts'),
    import('../conversations/finalize-voice-message.ts'),
    import('../../storage/voice-storage.ts'),
    import('../connections/cancel-connection.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;

  const createCustomer = async () => {
    const user = await prisma.user.create({
      data: {
        role: 'CUSTOMER',
        phoneNumber: `+226701${String(100000 + sequence++).slice(-6)}`,
        phoneVerifiedAt: new Date(),
        customerProfile: { create: {} },
      },
    });
    userIds.push(user.id);
    return user;
  };

  const createRelais = async () => {
    const user = await prisma.user.create({
      data: {
        role: 'RELAIS',
        phoneNumber: `+226702${String(100000 + sequence++).slice(-6)}`,
        phoneVerifiedAt: new Date(),
        relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } },
      },
    });
    userIds.push(user.id);
    return user;
  };

  const createFixture = async () => {
    const customer = await createCustomer();
    const relais = await createRelais();
    const connection = await prisma.connection.create({
      data: {
        customerId: customer.id,
        requestKey: `3b-${Date.now()}-${sequence++}`,
        lifecycle: 'CONNECTED',
        connectedAt: new Date(),
      },
    });
    connectionIds.push(connection.id);
    const assignment = await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    const conversation = await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createService.createQuickOffer({
      actor: relaisActor(relais),
      connectionId: connection.id,
      amount: 2000,
      clientOfferId: `3b-offer-${sequence++}`,
    }, prisma);
    return { customer, relais, connection, assignment, conversation, offer: offer.offer };
  };

  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user) => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: 'APPROVED' });

  const expectError = async (promise, ErrorClass, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ErrorClass);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('acceptance creates one QUICK Mission and transfers responsibility', async () => {
    try {
      const fixture = await createFixture();
      const result = await acceptService.acceptQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma);
      assert.equal(result.status, 'ACCEPTED');
      assert.equal(result.offer.status, 'ACCEPTED');
      assert.equal(result.offer.amount, 2000);
      assert.equal(result.offer.currency, 'XOF');
      assert.ok(result.offer.acceptedAt instanceof Date);
      assert.equal(result.mission.depth, 'QUICK');
      assert.equal(result.mission.urgency, 'NORMAL');
      assert.equal(result.mission.lifecycle, 'PENDING_EXECUTION');
      assert.equal(result.mission.acceptedQuickOfferId, fixture.offer.id);

      const storedConnection = await prisma.connection.findUnique({ where: { id: fixture.connection.id } });
      assert.equal(storedConnection?.lifecycle, 'ENDED');
      assert.equal(storedConnection?.terminalOutcome, 'MISSION_CREATED');
      assert.ok(storedConnection?.endedAt instanceof Date);
      assert.ok((await prisma.connectionAssignment.findUnique({ where: { id: fixture.assignment.id } }))?.endedAt instanceof Date);
      assert.equal(await prisma.mission.count({ where: { connectionId: fixture.connection.id } }), 1);
      assert.equal(await prisma.missionAssignment.count({ where: { missionId: result.mission.id, endedAt: null } }), 1);
      assert.equal((await prisma.missionAssignment.findFirst({ where: { missionId: result.mission.id, endedAt: null } }))?.relaisUserId, fixture.relais.id);

      const retry = await acceptService.acceptQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma);
      assert.equal(retry.status, 'EXISTING');
      assert.equal(retry.mission.id, result.mission.id);
      assert.equal(await prisma.mission.count({ where: { connectionId: fixture.connection.id } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('rejection is customer-owned, idempotent, and does not create a Mission', async () => {
    try {
      const fixture = await createFixture();
      const rejected = await rejectService.rejectQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma);
      assert.equal(rejected.status, 'REJECTED');
      assert.ok(rejected.offer.rejectedAt instanceof Date);
      assert.equal(await prisma.mission.count({ where: { connectionId: fixture.connection.id } }), 0);
      assert.equal((await prisma.connection.findUnique({ where: { id: fixture.connection.id } }))?.lifecycle, 'CONNECTED');
      const repeated = await rejectService.rejectQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma);
      assert.equal(repeated.status, 'ALREADY_REJECTED');
      assert.equal(repeated.offer.rejectedAt.toISOString(), rejected.offer.rejectedAt.toISOString());
    } finally {
      await cleanup();
    }
  });

  test('rejects wrong actors and stale commercial contexts', async () => {
    try {
      const fixture = await createFixture();
      const otherCustomer = await createCustomer();
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } });
      userIds.push(admin.id);
      await expectError(acceptService.acceptQuickOffer({ actor: customerActor(otherCustomer), quickOfferId: fixture.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'UNAUTHORIZED');
      await expectError(acceptService.acceptQuickOffer({ actor: relaisActor(fixture.relais), quickOfferId: fixture.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'UNAUTHORIZED');
      await expectError(rejectService.rejectQuickOffer({ actor: { userId: admin.id, role: 'ADMIN', accountStatus: 'ACTIVE' }, quickOfferId: fixture.offer.id }, prisma), rejectService.RejectQuickOfferError, 'UNAUTHORIZED');

      const replacement = await createRelais();
      await prisma.connectionAssignment.update({ where: { id: fixture.assignment.id }, data: { endedAt: new Date() } });
      await prisma.connectionAssignment.create({ data: { connectionId: fixture.connection.id, relaisUserId: replacement.id } });
      await expectError(acceptService.acceptQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'STALE_OFFER');
      assert.equal(await prisma.mission.count({ where: { connectionId: fixture.connection.id } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('superseded, rejected, and cancelled Offers cannot be accepted', async () => {
    try {
      const superseded = await createFixture();
      await createService.createQuickOffer({ actor: relaisActor(superseded.relais), connectionId: superseded.connection.id, amount: 3000, clientOfferId: 'replacement' }, prisma);
      await expectError(acceptService.acceptQuickOffer({ actor: customerActor(superseded.customer), quickOfferId: superseded.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'STALE_OFFER');

      const rejected = await createFixture();
      await rejectService.rejectQuickOffer({ actor: customerActor(rejected.customer), quickOfferId: rejected.offer.id }, prisma);
      await expectError(acceptService.acceptQuickOffer({ actor: customerActor(rejected.customer), quickOfferId: rejected.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'STALE_OFFER');

      const cancelled = await createFixture();
      await prisma.quickOffer.update({ where: { id: cancelled.offer.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await expectError(acceptService.acceptQuickOffer({ actor: customerActor(cancelled.customer), quickOfferId: cancelled.offer.id }, prisma), acceptService.AcceptQuickOfferError, 'STALE_OFFER');
    } finally {
      await cleanup();
    }
  });

  test('concurrent acceptance creates one Mission and communication continues through MissionAssignment', async () => {
    try {
      const fixture = await createFixture();
      const input = { actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id };
      const results = await Promise.all([acceptService.acceptQuickOffer(input, prisma), acceptService.acceptQuickOffer(input, prisma)]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['ACCEPTED', 'EXISTING']);
      assert.equal(new Set(results.map((result) => result.mission.id)).size, 1);
      assert.equal(await prisma.mission.count({ where: { connectionId: fixture.connection.id } }), 1);

      const customerText = await textService.sendTextMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'After mission', clientMessageId: 'after-mission-customer' }, prisma);
      const relaisText = await textService.sendTextMessage({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, text: 'Still responsible', clientMessageId: 'after-mission-relais' }, prisma);
      assert.equal(customerText.status, 'CREATED');
      assert.equal(relaisText.status, 'CREATED');

      const customerCall = await callService.prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma);
      const relaisCall = await callService.prepareNativeCallHandoff({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id }, prisma);
      assert.equal(customerCall.target.userId, fixture.relais.id);
      assert.equal(relaisCall.target.userId, fixture.customer.id);

      const storage = new InMemoryVoiceStorage();
      const upload = await voiceUploadService.prepareVoiceMessageUpload({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'after-mission-voice', mimeType: 'audio/m4a', byteSize: 512 }, prisma, storage);
      storage.putUpload(upload.uploadToken, { storageKey: upload.storageKey, mimeType: 'audio/m4a', byteSize: 512 });
      const voice = await voiceFinalizeService.finalizeVoiceMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, clientMessageId: 'after-mission-voice', uploadTokenOrKey: upload.uploadToken, durationMs: 1200 }, prisma, storage);
      assert.equal(voice.status, 'CREATED');
    } finally {
      await cleanup();
    }
  });

  test('acceptance and cancellation race leaves one terminal truth', async () => {
    try {
      const fixture = await createFixture();
      const results = await Promise.allSettled([
        acceptService.acceptQuickOffer({ actor: customerActor(fixture.customer), quickOfferId: fixture.offer.id }, prisma),
        cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma),
      ]);
      const stored = await prisma.connection.findUnique({ where: { id: fixture.connection.id } });
      assert.equal(stored?.lifecycle, 'ENDED');
      assert.ok(['MISSION_CREATED', 'CUSTOMER_CANCELLED'].includes(stored?.terminalOutcome ?? ''));
      const missionCount = await prisma.mission.count({ where: { connectionId: fixture.connection.id } });
      assert.ok(missionCount <= 1);
      if (stored?.terminalOutcome === 'MISSION_CREATED') assert.equal(missionCount, 1);
      if (stored?.terminalOutcome === 'CUSTOMER_CANCELLED') assert.equal(missionCount, 0);
      assert.ok(results.some((result) => result.status === 'fulfilled'));
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.callAction.deleteMany({ where: { conversation: { connectionId: { in: connectionIds } } } });
      await prisma.voiceMessageAsset.deleteMany({ where: { message: { conversation: { connectionId: { in: connectionIds } } } } });
      await prisma.message.deleteMany({ where: { conversation: { connectionId: { in: connectionIds } } } });
      await prisma.missionAssignment.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.mission.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.quickOffer.deleteMany({ where: { connectionId: { in: connectionIds } } });
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
