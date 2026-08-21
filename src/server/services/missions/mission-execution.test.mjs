import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Mission execution database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, { createPaymentAttempt }, { confirmPaymentAttempt }, executionService, readService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'), import('../quick-offers/create-quick-offer.ts'),
    import('../payments/create-payment-attempt.ts'), import('../payments/confirm-payment-attempt.ts'), import('./start-mission-execution.ts'), import('../payments/get-mission-payment-obligations.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;
  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user) => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: 'APPROVED' });
  const expectCode = async (promise, code) => assert.rejects(promise, (error) => error instanceof executionService.StartMissionExecutionError && error.code === code);

  async function fixture() {
    const customer = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226709${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } });
    userIds.push(customer.id);
    const relais = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226710${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } });
    userIds.push(relais.id);
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `3e-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date() } });
    connectionIds.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount: 2000, clientOfferId: `3e-offer-${sequence++}` }, prisma);
    const accepted = await acceptQuickOffer({ actor: customerActor(customer), quickOfferId: offer.offer.id }, prisma);
    return { customer, relais, connection, missionId: accepted.mission.id, obligationId: accepted.paymentObligation.id };
  }

  async function activate(f) {
    const attempt = await createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: `3e-payment-${sequence++}` }, prisma);
    await confirmPaymentAttempt({ paymentAttemptId: attempt.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: `3e-tx-${sequence++}`, confirmedAt: new Date(), confirmedAmount: 2000, currency: 'XOF' } }, prisma);
  }

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.paymentAttempt.deleteMany({ where: { paymentObligation: { mission: { connectionId: { in: connectionIds } } } } });
      await prisma.paymentObligation.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
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
    connectionIds.length = 0; userIds.length = 0;
  }

  test('paid QUICK Mission remains ACTIVE and records one immutable server start', async () => {
    try {
      const f = await fixture();
      await activate(f);
      const before = await prisma.paymentObligation.findUnique({ where: { id: f.obligationId }, select: { status: true } });
      const started = await executionService.startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
      assert.equal(started.status, 'STARTED'); assert.equal(started.mission.lifecycle, 'ACTIVE'); assert.ok(started.mission.executionStartedAt instanceof Date);
      const retry = await executionService.startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
      assert.equal(retry.status, 'ALREADY_STARTED'); assert.equal(retry.mission.executionStartedAt.toISOString(), started.mission.executionStartedAt.toISOString());
      assert.deepEqual(await prisma.paymentObligation.findUnique({ where: { id: f.obligationId }, select: { status: true } }), before);
      const read = await readService.getMissionPaymentObligations({ actor: customerActor(f.customer), missionId: f.missionId }, prisma);
      assert.equal(read.mission.lifecycle, 'ACTIVE'); assert.equal(read.mission.executionStartedAt?.toISOString(), started.mission.executionStartedAt.toISOString());
    } finally { await cleanup(); }
  });

  test('unpaid Mission and non-Customer actors cannot start execution', async () => {
    try {
      const f = await fixture();
      await expectCode(executionService.startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma), 'INVALID_MISSION_STATE');
      await expectCode(executionService.startMissionExecution({ actor: customerActor(f.customer), missionId: f.missionId }, prisma), 'UNAUTHORIZED');
    } finally { await cleanup(); }
  });

  test('unavailable current Relais may start, while former and ineligible Relais cannot', async () => {
    try {
      const f = await fixture();
      await activate(f);
      const former = f.relais;
      await prisma.connectionAssignment.updateMany({ where: { connectionId: f.connection.id, endedAt: null }, data: { endedAt: new Date() } });
      const replacement = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226711${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } });
      userIds.push(replacement.id);
      await prisma.missionAssignment.updateMany({ where: { missionId: f.missionId, endedAt: null }, data: { endedAt: new Date() } });
      await prisma.missionAssignment.create({ data: { missionId: f.missionId, relaisUserId: replacement.id } });
      await expectCode(executionService.startMissionExecution({ actor: relaisActor(former), missionId: f.missionId }, prisma), 'UNAUTHORIZED');
      const started = await executionService.startMissionExecution({ actor: relaisActor(replacement), missionId: f.missionId }, prisma);
      assert.equal(started.status, 'STARTED');
      const f2 = await fixture(); await activate(f2);
      await prisma.user.update({ where: { id: f2.relais.id }, data: { accountStatus: 'SUSPENDED' } });
      await expectCode(executionService.startMissionExecution({ actor: relaisActor(f2.relais), missionId: f2.missionId }, prisma), 'UNAUTHORIZED');
    } finally { await cleanup(); }
  });

  test('missing assignment, wrong depth, and concurrent starts are guarded', async () => {
    try {
      const f = await fixture(); await activate(f);
      await prisma.missionAssignment.deleteMany({ where: { missionId: f.missionId } });
      await expectCode(executionService.startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma), 'MISSION_ASSIGNMENT_MISSING');
      const f2 = await fixture(); await activate(f2);
      await prisma.mission.update({ where: { id: f2.missionId }, data: { depth: 'MANAGED' } });
      await expectCode(executionService.startMissionExecution({ actor: relaisActor(f2.relais), missionId: f2.missionId }, prisma), 'INVALID_MISSION_DEPTH');
      const f3 = await fixture(); await activate(f3);
      const results = await Promise.all([executionService.startMissionExecution({ actor: relaisActor(f3.relais), missionId: f3.missionId }, prisma), executionService.startMissionExecution({ actor: relaisActor(f3.relais), missionId: f3.missionId }, prisma)]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['ALREADY_STARTED', 'STARTED']);
      assert.equal(new Set(results.map((result) => result.mission.executionStartedAt.toISOString())).size, 1);
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
