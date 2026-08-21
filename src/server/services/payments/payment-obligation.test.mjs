import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Payment Obligation database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, paymentService, readService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'),
    import('../quick-offers/create-quick-offer.ts'), import('./create-quick-payment-obligation.ts'), import('./get-mission-payment-obligations.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;
  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user) => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: 'APPROVED' });
  const expectCode = async (promise, ErrorClass, code) => assert.rejects(promise, (error) => error instanceof ErrorClass && error.code === code);

  async function fixture({ amount = 3750, currency = 'XOF' } = {}) {
    const customer = await prisma.user.create({ data: {
      role: 'CUSTOMER', phoneNumber: `+226703${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} },
    } });
    userIds.push(customer.id);
    const relais = await prisma.user.create({ data: {
      role: 'RELAIS', phoneNumber: `+226704${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(),
      relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } },
    } });
    userIds.push(relais.id);
    const connection = await prisma.connection.create({ data: {
      customerId: customer.id, requestKey: `3c-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date(),
    } });
    connectionIds.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount, currency, clientOfferId: `3c-offer-${sequence++}` }, prisma);
    return { customer, relais, connection, offer: offer.offer };
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
    connectionIds.length = 0;
    userIds.length = 0;
  }

  test('acceptance creates one pending RELAIS fee with exact offer terms and provenance', async () => {
    try {
      const f = await fixture();
      const accepted = await acceptQuickOffer({ actor: customerActor(f.customer), quickOfferId: f.offer.id }, prisma);
      assert.equal(accepted.paymentObligation.purpose, 'RELAIS_FEE');
      assert.equal(accepted.paymentObligation.status, 'PENDING');
      assert.equal(accepted.paymentObligation.amount, 3750);
      assert.equal(accepted.paymentObligation.currency, 'XOF');
      assert.equal(accepted.paymentObligation.sourceQuickOfferId, f.offer.id);
      assert.equal(await prisma.paymentObligation.count({ where: { missionId: accepted.mission.id } }), 1);
      const retry = await acceptQuickOffer({ actor: customerActor(f.customer), quickOfferId: f.offer.id }, prisma);
      assert.equal(retry.paymentObligation.id, accepted.paymentObligation.id);
    } finally { await cleanup(); }
  });

  test('direct creation is idempotent and concurrent calls preserve one obligation', async () => {
    try {
      const f = await fixture({ amount: 4900 });
      const accepted = await acceptQuickOffer({ actor: customerActor(f.customer), quickOfferId: f.offer.id }, prisma);
      const results = await Promise.all([
        paymentService.createQuickPaymentObligation({ missionId: accepted.mission.id }, prisma),
        paymentService.createQuickPaymentObligation({ missionId: accepted.mission.id }, prisma),
      ]);
      assert.equal(new Set(results.map((result) => result.obligation.id)).size, 1);
      assert.equal(await prisma.paymentObligation.count({ where: { missionId: accepted.mission.id } }), 1);
    } finally { await cleanup(); }
  });

  test('owning Customer and current Mission Relais can read, unrelated actors cannot', async () => {
    try {
      const f = await fixture();
      const accepted = await acceptQuickOffer({ actor: customerActor(f.customer), quickOfferId: f.offer.id }, prisma);
      const customerRead = await readService.getMissionPaymentObligations({ actor: customerActor(f.customer), missionId: accepted.mission.id }, prisma);
      const relaisRead = await readService.getMissionPaymentObligations({ actor: relaisActor(f.relais), missionId: accepted.mission.id }, prisma);
      assert.equal(customerRead.obligations[0].id, accepted.paymentObligation.id);
      assert.equal(relaisRead.obligations[0].id, accepted.paymentObligation.id);
      const other = await prisma.user.create({ data: {
        role: 'CUSTOMER', phoneNumber: `+226705${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} },
      } });
      userIds.push(other.id);
      await expectCode(readService.getMissionPaymentObligations({ actor: customerActor(other), missionId: accepted.mission.id }, prisma), readService.GetMissionPaymentObligationsError, 'UNAUTHORIZED');
    } finally { await cleanup(); }
  });

  test('rejects non-QUICK missions without creating another obligation', async () => {
    try {
      const f = await fixture();
      const accepted = await acceptQuickOffer({ actor: customerActor(f.customer), quickOfferId: f.offer.id }, prisma);
      await prisma.paymentObligation.deleteMany({ where: { missionId: accepted.mission.id } });
      await prisma.mission.update({ where: { id: accepted.mission.id }, data: { depth: 'MANAGED', acceptedQuickOfferId: null } });
      await expectCode(paymentService.createQuickPaymentObligation({ missionId: accepted.mission.id }, prisma), paymentService.CreateQuickPaymentObligationError, 'INVALID_MISSION_DEPTH');
      assert.equal(await prisma.paymentObligation.count({ where: { missionId: accepted.mission.id } }), 0);
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
