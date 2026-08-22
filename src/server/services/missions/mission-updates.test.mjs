import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Mission Update database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, { createPaymentAttempt }, { confirmPaymentAttempt }, { startMissionExecution }, createService, listService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'), import('../quick-offers/create-quick-offer.ts'),
    import('../payments/create-payment-attempt.ts'), import('../payments/confirm-payment-attempt.ts'), import('./start-mission-execution.ts'), import('./create-mission-update.ts'), import('./list-mission-updates.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;
  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user, eligibility = 'APPROVED') => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: eligibility });
  const adminActor = (user) => ({ userId: user.id, role: 'ADMIN', accountStatus: user.accountStatus });
  const expectCode = async (promise, ErrorClass, code) => assert.rejects(promise, (error) => error instanceof ErrorClass && error.code === code);

  async function fixture() {
    const customer = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226712${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } });
    userIds.push(customer.id);
    const relais = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226713${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } });
    userIds.push(relais.id);
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `3f-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date() } });
    connectionIds.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount: 2000, clientOfferId: `3f-offer-${sequence++}` }, prisma);
    const accepted = await acceptQuickOffer({ actor: customerActor(customer), quickOfferId: offer.offer.id }, prisma);
    return { customer, relais, connection, missionId: accepted.mission.id, obligationId: accepted.paymentObligation.id };
  }

  async function activate(f) {
    const attempt = await createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: `3f-payment-${sequence++}` }, prisma);
    await confirmPaymentAttempt({ paymentAttemptId: attempt.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: `3f-tx-${sequence++}`, confirmedAt: new Date(), confirmedAmount: 2000, currency: 'XOF' } }, prisma);
  }

  async function start(f) {
    await activate(f);
    await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
  }

  async function createUpdate(f, overrides = {}) {
    return createService.createMissionUpdate({ actor: overrides.actor ?? relaisActor(f.relais), missionId: f.missionId, type: overrides.type ?? 'PROGRESS', text: overrides.text ?? 'Colis récupéré.', clientUpdateId: overrides.clientUpdateId ?? `3f-update-${sequence++}` }, prisma);
  }

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.missionUpdate.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.paymentAttempt.deleteMany({ where: { paymentObligation: { mission: { connectionId: { in: connectionIds } } } } });
      await prisma.paymentObligation.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.missionAssignment.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.mission.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.quickOffer.deleteMany({ where: { connectionId: { in: connectionIds } } });
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
    connectionIds.length = 0; userIds.length = 0;
  }

  test('started QUICK Relais creates Unicode progress without lifecycle or Message side effects', async () => {
    try {
      const f = await fixture(); await start(f);
      const before = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, executionStartedAt: true } });
      const messageCount = await prisma.message.count({ where: { conversation: { connectionId: f.connection.id } } });
      const result = await createUpdate(f, { text: 'Le colis est arrivé à Ouahigouya — j’attends à l’entrée. 👍🏾' });
      assert.equal(result.status, 'CREATED'); assert.equal(result.update.authorUserId, f.relais.id); assert.equal(result.update.type, 'PROGRESS');
      assert.equal(result.update.text, 'Le colis est arrivé à Ouahigouya — j’attends à l’entrée. 👍🏾');
      assert.deepEqual(await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, executionStartedAt: true } }), before);
      assert.equal(await prisma.message.count({ where: { conversation: { connectionId: f.connection.id } } }), messageCount);
    } finally { await cleanup(); }
  });

  test('updates require started ACTIVE QUICK execution and authorized Relais', async () => {
    try {
      const f = await fixture();
      await expectCode(createUpdate(f), createService.CreateMissionUpdateError, 'INVALID_MISSION_STATE');
      await activate(f);
      await expectCode(createUpdate(f, { actor: customerActor(f.customer) }), createService.CreateMissionUpdateError, 'UNAUTHORIZED');
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } }); userIds.push(admin.id);
      await expectCode(createUpdate(f, { actor: adminActor(admin) }), createService.CreateMissionUpdateError, 'UNAUTHORIZED');
      await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
      const former = f.relais;
      await prisma.missionAssignment.updateMany({ where: { missionId: f.missionId, endedAt: null }, data: { endedAt: new Date() } });
      const replacement = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226714${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } });
      userIds.push(replacement.id); await prisma.missionAssignment.create({ data: { missionId: f.missionId, relaisUserId: replacement.id } });
      await expectCode(createUpdate(f, { actor: relaisActor(former) }), createService.CreateMissionUpdateError, 'UNAUTHORIZED');
      const replacementUpdate = await createUpdate(f, { actor: relaisActor(replacement), text: 'Mission reprise.' });
      assert.equal(replacementUpdate.update.authorUserId, replacement.id);
    } finally { await cleanup(); }
  });

  test('idempotency, conflicts, and concurrent duplicates preserve one update', async () => {
    try {
      const f = await fixture(); await start(f);
      const input = { actor: relaisActor(f.relais), missionId: f.missionId, type: 'PROGRESS', text: 'Document déposé.', clientUpdateId: 'same-update' };
      const first = await createService.createMissionUpdate(input, prisma); const retry = await createService.createMissionUpdate(input, prisma);
      assert.equal(retry.status, 'EXISTING'); assert.equal(retry.update.id, first.update.id);
      await expectCode(createService.createMissionUpdate({ ...input, text: 'Autre texte.' }, prisma), createService.CreateMissionUpdateError, 'IDEMPOTENCY_CONFLICT');
      const concurrentInput = { ...input, clientUpdateId: 'concurrent-update', text: 'Attente au guichet.' };
      const results = await Promise.all([createService.createMissionUpdate(concurrentInput, prisma), createService.createMissionUpdate(concurrentInput, prisma)]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['CREATED', 'EXISTING']);
      assert.equal(await prisma.missionUpdate.count({ where: { missionId: f.missionId } }), 2);
    } finally { await cleanup(); }
  });

  test('multiple updates paginate deterministically and preserve author history', async () => {
    try {
      const f = await fixture(); await start(f);
      await createUpdate(f, { text: 'Un.' }); await createUpdate(f, { text: 'Deux.' }); await createUpdate(f, { text: 'Trois.' });
      const first = await listService.listMissionUpdates({ actor: customerActor(f.customer), missionId: f.missionId, limit: 2 }, prisma);
      assert.deepEqual(first.updates.map((update) => update.text), ['Deux.', 'Trois.']); assert.ok(first.nextCursor);
      const second = await listService.listMissionUpdates({ actor: customerActor(f.customer), missionId: f.missionId, cursor: first.nextCursor, limit: 2 }, prisma);
      assert.deepEqual(second.updates.map((update) => update.text), ['Un.']); assert.equal(second.nextCursor, null);
      const relaisRead = await listService.listMissionUpdates({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
      assert.equal(relaisRead.updates[0].authorUserId, f.relais.id);
    } finally { await cleanup(); }
  });

  test('read authorization and deletion safety preserve historical updates', async () => {
    try {
      const f = await fixture(); await start(f); await createUpdate(f);
      const other = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226715${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } }); userIds.push(other.id);
      await expectCode(listService.listMissionUpdates({ actor: customerActor(other), missionId: f.missionId }, prisma), listService.ListMissionUpdatesError, 'UNAUTHORIZED');
      await assert.rejects(prisma.mission.delete({ where: { id: f.missionId } }), /MissionUpdate|restrict|violat/i);
      assert.equal(await prisma.missionUpdate.count({ where: { missionId: f.missionId } }), 1);
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
